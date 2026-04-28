# CI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement four CI improvements: release gating on CI passing (#38), binary size budget enforcement in release (#50), CHANGELOG update enforcement on PRs (#51), and SonarCloud coverage collection (#53).

**Architecture:** All changes are additive to two existing workflow files (`ci.yml`, `release.yml`) plus a new `sonar-project.properties` config file and minor frontend config updates. No new workflow files. Tasks 1–2 both touch `release.yml` and must run sequentially; Tasks 3–6 each touch a different file and can be done in any order after Task 1.

**Tech Stack:** GitHub Actions YAML, bash, `gh` CLI (already on runners), `@vitest/coverage-v8`, `cargo-llvm-cov` (via `taiki-e/install-action`), SonarCloud (`SonarSource/sonarcloud-github-action`)

---

## Files

| Action | File | Purpose |
|--------|------|---------|
| Modify | `.github/workflows/release.yml` | Add `ci-gate` job (#38); add `profile.sh` step (#50) |
| Modify | `.github/workflows/ci.yml` | Add CHANGELOG check to `build-check` (#51); add `coverage` job (#53) |
| Modify | `vite.config.ts` | Add coverage provider, reporters, output dir (#53) |
| Modify | `package.json` | Add `@vitest/coverage-v8` devDep; add `test:coverage` script (#53) |
| Modify | `.gitignore` | Exclude generated coverage dirs (#53) |
| Create | `sonar-project.properties` | SonarCloud project config (#53) |

---

### Task 1: Add ci-gate job to release.yml (#38)

**Files:**
- Modify: `.github/workflows/release.yml`

Adds a `ci-gate` job that queries the GitHub Checks API for the tagged commit and verifies `Build Check`, `Test`, and `Security Audit` all have `conclusion: success`. All three downstream jobs gain `needs: ci-gate`.

- [ ] **Step 1: Read the current release.yml to confirm structure**

```bash
head -15 .github/workflows/release.yml
```
Expected: see `jobs:` followed by `release-linux:` as the first job.

- [ ] **Step 2: Insert ci-gate job**

In `.github/workflows/release.yml`, insert the following block between the `jobs:` line and the `  release-linux:` line:

```yaml
  ci-gate:
    name: CI Gate
    runs-on: ubuntu-22.04
    permissions:
      checks: read
    steps:
      - name: Verify CI passed on tagged commit
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SHA: ${{ github.sha }}
          REPO: ${{ github.repository }}
        run: |
          set -euo pipefail
          REQUIRED=("Build Check" "Test" "Security Audit")

          echo "Checking CI status for commit ${SHA} in ${REPO}..."
          RESULT=$(gh api "repos/${REPO}/commits/${SHA}/check-runs" --paginate)

          ALL_PASS=true
          for CHECK in "${REQUIRED[@]}"; do
            CONCLUSION=$(echo "$RESULT" | jq -r --arg name "$CHECK" \
              '[.check_runs[] | select(.name == $name)] | last | .conclusion // "not found"')
            if [[ "$CONCLUSION" == "success" ]]; then
              echo "PASS: ${CHECK}"
            else
              echo "FAIL: ${CHECK} — conclusion=${CONCLUSION}"
              ALL_PASS=false
            fi
          done

          if [[ "$ALL_PASS" != "true" ]]; then
            echo ""
            echo "Release blocked: required CI checks did not all pass on ${SHA}."
            echo "Fix the failing checks and re-tag from a green commit."
            exit 1
          fi

          echo "All required checks passed. Proceeding with release."

```

- [ ] **Step 3: Add `needs: ci-gate` to release-linux**

Find the `release-linux` job header (currently `runs-on: ubuntu-22.04` with no `needs:`). Add `needs: ci-gate` after `runs-on`:

```yaml
  release-linux:
    name: Build and Release (Linux)
    runs-on: ubuntu-22.04
    needs: ci-gate
```

- [ ] **Step 4: Update needs for publish-aur and publish-apt-repo**

Both jobs currently have `needs: release-linux`. Change both to:

```yaml
    needs: [ci-gate, release-linux]
```

`publish-aur` is at line ~130 and `publish-apt-repo` is at line ~237 — check with `grep -n "needs: release-linux" .github/workflows/release.yml`.

- [ ] **Step 5: Validate YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "YAML valid"
```
Expected: `YAML valid`

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: gate release on CI passing — pre-flight check job (#38)"
```

---

### Task 2: Add binary size budget check to release.yml (#50)

**Files:**
- Modify: `.github/workflows/release.yml`

Adds a `bash scripts/profile.sh --no-launch` step immediately after `pnpm tauri build`. The `--no-launch` flag skips runtime checks (startup, memory, CPU — which need a display) and runs only the static binary size check against the 15 MB budget. The release binary is already present at `src-tauri/target/release/alpaka-desktop` at this point.

- [ ] **Step 1: Find the tauri build step line number**

```bash
grep -n "pnpm tauri build\|Locate artifacts" .github/workflows/release.yml
```
Note the line number of `pnpm tauri build` — the new step goes after it.

- [ ] **Step 2: Insert the profile step**

After the `pnpm tauri build` step (which includes `env:\n  CI: true`), insert:

```yaml
      # ------------------------------------------------------------------ #
      # 7. Binary size budget check                                         #
      # ------------------------------------------------------------------ #
      - name: Run binary size budget check
        run: bash scripts/profile.sh --no-launch
```

The existing "Locate artifacts" step comment says `# 7.` — update it to `# 8.` and shift subsequent section numbers accordingly.

- [ ] **Step 3: Validate YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && echo "YAML valid"
```
Expected: `YAML valid`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: enforce binary size budget in release pipeline (#50)"
```

---

### Task 3: Add CHANGELOG enforcement to ci.yml (#51)

**Files:**
- Modify: `.github/workflows/ci.yml`

Adds a step at the end of the `build-check` job (after "Prettier check"). Runs only on `pull_request` events. If `CHANGELOG.md` is not in the PR diff: PRs labeled `type: ci` or `type: docs` get a warning and pass; all others fail with a message pointing to `[Unreleased]`.

Labels are read via an `env:` var (never interpolated inline into `run:`) to prevent injection.

- [ ] **Step 1: Confirm end of build-check job**

```bash
grep -n "Prettier check\|^  test:" .github/workflows/ci.yml
```
The new step goes after the "Prettier check" step and before `  test:`.

- [ ] **Step 2: Insert CHANGELOG check step**

Append this step to the `build-check` job's steps (after `run: pnpm format:check`):

```yaml
      - name: Check CHANGELOG updated
        if: github.event_name == 'pull_request'
        env:
          PR_LABELS: ${{ toJson(github.event.pull_request.labels) }}
          BASE_REF: ${{ github.base_ref }}
        run: |
          set -euo pipefail

          git fetch origin "${BASE_REF}" --depth=1
          CHANGED=$(git diff --name-only "origin/${BASE_REF}...HEAD")

          if echo "$CHANGED" | grep -q "^CHANGELOG.md$"; then
            echo "CHANGELOG.md updated."
            exit 0
          fi

          ADVISORY=$(echo "$PR_LABELS" | jq -r '.[].name' | grep -E '^type: (ci|docs)$' | head -1 || true)

          if [[ -n "$ADVISORY" ]]; then
            echo "WARNING: CHANGELOG.md not updated, but PR is labeled '${ADVISORY}' — advisory only."
            exit 0
          fi

          echo "ERROR: CHANGELOG.md not updated."
          echo "Please add an entry under [Unreleased] in CHANGELOG.md."
          echo "For CI-only or docs-only PRs, add the 'type: ci' or 'type: docs' label to suppress this check."
          exit 1
```

- [ ] **Step 3: Validate YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
```
Expected: `YAML valid`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: enforce CHANGELOG update on PRs — advisory for type:ci/docs (#51)"
```

---

### Task 4: Configure Vitest coverage (#53)

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `.gitignore`

Installs `@vitest/coverage-v8`, adds `test:coverage` script, wires up coverage config in vitest.

- [ ] **Step 1: Install @vitest/coverage-v8**

```bash
pnpm add -D @vitest/coverage-v8
```
Expected: `package.json` devDependencies gains `@vitest/coverage-v8`, lockfile updated.

- [ ] **Step 2: Add test:coverage script to package.json**

In `package.json` `"scripts"` block, add after `"test": "vitest run"`:
```json
"test:coverage": "vitest run --coverage",
```

- [ ] **Step 3: Add coverage config to vite.config.ts**

Read `vite.config.ts`. The current `test:` block ends with the `exclude` array. Replace the entire `test:` block with:

```ts
  test: {
    environment: 'happy-dom',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/.tabs/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage',
    },
  }
```

- [ ] **Step 4: Add coverage dirs to .gitignore**

```bash
grep -q '^coverage/$' .gitignore || echo 'coverage/' >> .gitignore
grep -q '^coverage-rust/$' .gitignore || echo 'coverage-rust/' >> .gitignore
```

- [ ] **Step 5: Run coverage locally to verify**

```bash
pnpm test:coverage
```
Expected: all tests pass, `coverage/` directory created containing `lcov.info` and `index.html`.

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.ts pnpm-lock.yaml .gitignore
git commit -m "ci: add Vitest coverage config with v8 provider and LCOV output (#53)"
```

---

### Task 5: Create sonar-project.properties (#53)

**Files:**
- Create: `sonar-project.properties`

SonarCloud project config. Project key and org are both `nikoteressi`. Sources point to the Vue/TS frontend only (SonarCloud community edition does not analyze Rust). Coverage is fed from the Vitest LCOV report.

- [ ] **Step 1: Create sonar-project.properties**

Create `sonar-project.properties` at the repo root with this content:

```properties
sonar.projectKey=nikoteressi
sonar.organization=nikoteressi

sonar.sources=src
sonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.ts,**/*.spec.ts,**/*.test.vue,**/*.spec.vue

sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.typescript.lcov.reportPaths=coverage/lcov.info
```

- [ ] **Step 2: Commit**

```bash
git add sonar-project.properties
git commit -m "ci: add SonarCloud project configuration (#53)"
```

---

### Task 6: Add coverage job to ci.yml (#53)

**Files:**
- Modify: `.github/workflows/ci.yml`

Adds a `coverage` job (`needs: test`). Runs Vitest with coverage (LCOV), runs `cargo-llvm-cov` (LCOV + HTML), uploads to SonarCloud, uploads HTML reports as 30-day artifacts.

- [ ] **Step 1: Look up SonarCloud action SHA**

```bash
gh api repos/SonarSource/sonarcloud-github-action/git/ref/tags/v3 --jq '.object.sha'
```
Save the SHA — it replaces `<SONAR_SHA>` in Step 2.

- [ ] **Step 2: Look up actions/upload-artifact SHA**

```bash
gh api repos/actions/upload-artifact/git/ref/tags/v4 --jq '.object.sha'
```
Save the SHA — it replaces `<UPLOAD_SHA>` in Step 3.

- [ ] **Step 3: Append coverage job to ci.yml**

Append the following to `.github/workflows/ci.yml`, substituting the SHAs from Steps 1 and 2:

```yaml
  coverage:
    name: Coverage
    runs-on: ubuntu-22.04
    needs: test
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
        with:
          fetch-depth: 0

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@3c5f7ea28cd621ae0bf5283f0e981fb97b8a7af9 # @stable (master)
        with:
          toolchain: stable

      - name: Install Linux system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libgtk-3-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev \
            libssl-dev \
            pkg-config

      - name: Cache cargo registry
        uses: actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 # v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
          key: ${{ runner.os }}-cargo-coverage-${{ hashFiles('**/Cargo.lock') }}

      - name: Install cargo-llvm-cov
        uses: taiki-e/install-action@1f2425cdb59f8fffb99ee16a5968edf6f57a2b93 # v2
        with:
          tool: cargo-llvm-cov

      - name: Setup pnpm
        uses: pnpm/action-setup@f40ffcd9367d9f12939873eb1018b921a783ffaa # v4

      - name: Setup Node.js
        uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install npm dependencies
        run: pnpm install --frozen-lockfile

      - name: Run Vitest with coverage
        run: pnpm test:coverage

      - name: Run Rust coverage
        run: |
          cargo llvm-cov --workspace --lcov --output-path coverage-rust/lcov.info
          cargo llvm-cov --workspace --html --output-dir coverage-rust/html
        working-directory: src-tauri

      - name: SonarCloud scan
        uses: SonarSource/sonarcloud-github-action@<SONAR_SHA>  # v3
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

      - name: Upload TypeScript coverage report
        uses: actions/upload-artifact@<UPLOAD_SHA>  # v4
        with:
          name: vitest-coverage
          path: coverage/
          retention-days: 30

      - name: Upload Rust coverage report
        uses: actions/upload-artifact@<UPLOAD_SHA>  # v4
        with:
          name: cargo-coverage
          path: src-tauri/coverage-rust/html/
          retention-days: 30
```

- [ ] **Step 4: Validate YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
```
Expected: `YAML valid`

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add coverage job with SonarCloud integration and artifact upload (#53)"
```

---

### Task 7: Push, open PR, update CHANGELOG, close issues

- [ ] **Step 1: Push branch**

```bash
git push
```

- [ ] **Step 2: Update CHANGELOG.md**

Add to the `[Unreleased]` section in `CHANGELOG.md`:

```markdown
### Added
- CI: Gate releases on CI passing — `ci-gate` pre-flight job verifies Build Check, Test, and Security Audit before any publish step runs (#38)
- CI: Enforce binary size budget (15 MB) in release pipeline via `scripts/profile.sh --no-launch` (#50)
- CI: Enforce CHANGELOG update on PRs — advisory for `type: ci` and `type: docs` labels (#51)
- CI: Collect code coverage with Vitest (v8) and cargo-llvm-cov; upload to SonarCloud and as GitHub Actions artifacts (#53)
```

- [ ] **Step 3: Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs: update CHANGELOG for CI improvements (#38 #50 #51 #53)"
git push
```

- [ ] **Step 4: Create PR**

```bash
gh pr create \
  --title "ci: release gating, binary budget, CHANGELOG enforcement, SonarCloud coverage" \
  --body "$(cat <<'EOF'
## Summary
- Add `ci-gate` job to release pipeline — blocks publish if CI checks didn't pass on the tagged commit (#38)
- Run `scripts/profile.sh --no-launch` after Tauri build to enforce 15 MB binary size budget (#50)
- Fail PRs that don't update `CHANGELOG.md`; advisory for `type: ci` / `type: docs` labels (#51)
- Collect Vitest + cargo-llvm-cov coverage, upload to SonarCloud and as artifacts (#53)

Closes #38
Closes #50
Closes #51
Closes #53

## Test plan
- [ ] Push a tag on this branch to verify `ci-gate` blocks release (CI not green on this commit)
- [ ] Check Actions tab: `coverage` job appears, SonarCloud scan runs, artifacts uploaded
- [ ] Verify `build-check` CHANGELOG step passes (CHANGELOG updated in this PR)
EOF
)"
```

- [ ] **Step 5: Label the PR `type: ci`**

```bash
gh pr edit --add-label "type: ci"
```
