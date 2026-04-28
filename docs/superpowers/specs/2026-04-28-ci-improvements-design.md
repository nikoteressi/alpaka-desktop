# CI Improvements Design

**Date:** 2026-04-28
**Issues:** #38, #50, #51, #53

---

## Scope

Four independent CI gaps, each resolved by targeted additions to existing workflows. No new workflow files needed — all changes go into `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `vite.config.ts`, and a new `sonar-project.properties`.

---

## #38 — Release gating (ci-gate job)

**Problem:** `release.yml` triggers on `push: tags: v*` with no requirement that CI passed on that commit. A tag on a broken commit immediately triggers a publish.

**Solution:** Add a `ci-gate` job as the first job in `release.yml`. All downstream jobs (`release-linux`, `publish-aur`, `publish-apt`) gain `needs: ci-gate`.

**Implementation:**
- Job queries `gh api /repos/{owner}/{repo}/commits/{sha}/check-runs` for the tagged commit
- Filters to workflow name `CI` and checks that `Build Check`, `Test`, and `Security Audit` all have `conclusion: success`
- Uses the existing `GITHUB_TOKEN` (already has `contents: write` in `release.yml`)
- Fails with a clear message if any required check is missing or not `success`
- No new secrets required

**Edge case:** Tags pushed to old commits with no CI run will fail the gate, forcing a re-tag from a green commit.

---

## #50 — Binary size budget check in release

**Problem:** `scripts/profile.sh` enforces a 15 MB binary size budget but is never called in CI.

**Solution:** Add one step in `release.yml` immediately after `pnpm tauri build` and before "Locate artifacts":

```yaml
- name: Run binary size budget check
  run: bash scripts/profile.sh --no-launch
```

**Why `--no-launch`:** The `--no-launch` flag already exists in `profile.sh` — it skips startup time, PSS memory, and CPU checks (which require a running display) and runs only the static binary size check. The binary at `src-tauri/target/release/alpaka-desktop` is already present at this point. If size exceeds 15 MB the step exits non-zero and the release aborts before any artifact is uploaded.

---

## #51 — CHANGELOG enforcement

**Problem:** The PR checklist asks contributors to update `CHANGELOG.md` but nothing in CI verifies it.

**Solution:** Add a step to the `build-check` job in `ci.yml`, gated to PR events only (`if: github.event_name == 'pull_request'`).

**Logic:**
1. `git diff --name-only origin/${{ github.base_ref }}...HEAD` — list files changed in this PR
2. Check if `CHANGELOG.md` appears in that list
3. Read PR labels from `github.event.pull_request.labels` via an `env:` var (not inline interpolation — injection-safe)
4. If labels contain `type: ci` or `type: docs` → print advisory warning, exit 0
5. Otherwise → exit 1 with message directing contributor to update `[Unreleased]`

**Advisory rationale:** Infrastructure and docs PRs (this very issue, for example) don't produce user-visible changes that belong in the changelog. Blocking them creates friction without value.

---

## #53 — Code coverage + SonarCloud

**Problem:** No coverage is collected. No visibility into test gaps.

**Solution:** Add a `coverage` job in `ci.yml` (`needs: test`), collect LCOV from both Vitest and cargo-llvm-cov, upload to SonarCloud, and keep HTML artifacts as fallback.

### Frontend (Vitest)

- Add `@vitest/coverage-v8` to `devDependencies`
- Add `test:coverage` script: `vitest run --coverage`
- Configure in `vite.config.ts`:
  ```ts
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    reportsDirectory: 'coverage',
  }
  ```
- Output: `coverage/lcov.info`

### Rust (cargo-llvm-cov)

- Install via `taiki-e/install-action` (prebuilt binary, fast)
- Run: `cargo llvm-cov --workspace --lcov --output-path coverage-rust/lcov.info`
- No `--locked` needed (llvm-cov wraps cargo test, not a lockfile dependency)
- Output: `coverage-rust/lcov.info`

### SonarCloud

- **Project:** `nikoteressi` / org: `nikoteressi`
- **Secret:** `SONAR_TOKEN` (repo secret, already created by user)
- **Action:** `SonarSource/sonarcloud-github-action` pinned to SHA
- **Config file:** `sonar-project.properties` at repo root

`sonar-project.properties`:
```properties
sonar.projectKey=nikoteressi
sonar.organization=nikoteressi
sonar.sources=src,src-tauri/src
sonar.exclusions=**/node_modules/**,**/dist/**,**/target/**,**/*.test.*,**/*.spec.*
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.coverageReportPaths=coverage-rust/lcov.info
sonar.rust.lcov.reportPaths=coverage-rust/lcov.info
```

### Artifacts (fallback)

Upload `coverage/` and `coverage-rust/` as GitHub Actions artifacts with 30-day retention. Allows downloading the full HTML report without needing SonarCloud access.

### Thresholds

None enforced now. Set quality gates in the SonarCloud UI after the first baseline run establishes current coverage percentages.

---

## Files changed

| File | Change |
|------|--------|
| `.github/workflows/release.yml` | Add `ci-gate` job; add profile.sh step after tauri build |
| `.github/workflows/ci.yml` | Add CHANGELOG check step in `build-check`; add `coverage` job |
| `vite.config.ts` | Add coverage configuration block |
| `package.json` | Add `test:coverage` script; add `@vitest/coverage-v8` devDep |
| `sonar-project.properties` | New file — SonarCloud project config |
