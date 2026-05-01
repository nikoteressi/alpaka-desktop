# Changelog

All notable changes to Alpaka Desktop are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- Dependencies: bump `@vueuse/core` 11→14, `shiki` 1→4, `vue-tsc` 2→3; upgrade Rust crates `rusqlite` 0.31→0.39, `thiserror` 1→2, `mockall` 0.13→0.14; upgrade GitHub Actions `actions/checkout` v5→v6, `pnpm/action-setup` v4→v6, `softprops/action-gh-release` v2→v3; remove unused `vue-i18n` dependency

### Fixed
- Security: bump transitive `fast-xml-parser` to 5.7.0 (Dependabot #13 — XML comment/CDATA injection) and `tmp` to 0.2.4 (Dependabot #11 — symlink write vulnerability) via pnpm overrides; both packages are dev-only, never shipped in the app bundle
- Security: `security-audit` CI job now also runs `pnpm audit` for frontend-only PRs (previously only triggered when Rust files changed, leaving npm dep changes unaudited)
- CI: `e2e-integration` now depends on `build-check` success — broken builds no longer trigger a wasteful full E2E + Ollama pull cycle
- CI: cache `tauri-driver` binary across e2e jobs keyed on `Cargo.lock` hash — avoids recompiling from source on every run when the driver version hasn't changed
- CI: release gate now also requires "Spell Check (typos)" and "E2E Smoke Tests" to pass before proceeding with artifact build and publish
- SonarCloud: simplify two regular expressions in `MessageBubble.vue` (lines 75 and 182) from complexity 25/23 to below the allowed threshold of 20 by extracting `<tool_call>` attribute parsing into secondary regex calls

---

## [1.2.0] - 2026-05-01

### Added
- S-07: Seed control — fixed-seed input in Advanced Options and Settings for reproducible generation; active seed shown in message performance metadata (#20)
- S-08: Mirostat v1/v2 sampling controls in Advanced Chat Options — Mirostat mode selector (Off/Mirostat 1/Mirostat 2) with tau (default 5.0) and eta (default 0.1) sliders; top-p/top-k hidden when Mirostat is active
- S-06: Custom stop sequences — Settings → Advanced tab with a tag-input for up to 4 stop tokens (e.g. `###`, `<END>`). Sequences are sent as `options.stop` in every Ollama chat request; empty list omits the field entirely. Setting key allowlist added to the backend `set_setting` command.
- MO-06: Custom model creation from Modelfile — create and edit Ollama models directly in the app with a CodeMirror editor, streaming progress, background creation, desktop notifications, and mid-stream cancellation (#22)
- S-10: Per-model default generation settings — each installed model can have its own temperature, context window, and other generation defaults. Edit from the model detail page (Models → Local tab → click a model). Defaults auto-apply when selecting a model for a new or existing conversation. Save current chat settings as model defaults from the Advanced Options panel.
- S-09: Per-conversation preset profiles for generation settings — four built-in presets (Creative, Balanced, Precise, Code), user-defined presets with save/delete, preset selection persisted per-chat via draft, default preset applied to new conversations. Advanced Options popover shows the active preset name.
- Security: `is_cloud_host()` now uses URL hostname parsing instead of substring match, preventing subdomain-prefix attacks that would exfiltrate the Ollama Cloud API key to attacker-controlled hosts.
- MO-08: Configurable Ollama model storage path — Settings Engine tab writes a systemd service override (`OLLAMA_MODELS`) and restarts Ollama on save; user service handled automatically, system service via pkexec; live path validation with model count and accessibility feedback
- CL-05: Ollama Cloud routing — stored API key is now injected as `Authorization: Bearer` on all requests to `api.ollama.com` hosts. Missing key surfaces a friendly error in the chat rather than a raw network failure. Saving a key for the first time auto-adds the Ollama Cloud host entry.
- MO-07: Model tags and favorites — star models as favorites to float them to the top of the model selector, apply custom text tags to organize local models, and filter by tag in both the local models tab and chat model selector.

### Fixed
- CI: add `src/composables/useStreamingEvents.test.ts` — 30 Vitest tests covering all 8 Tauri event handlers; add `sonar.coverage.exclusions` for framework boilerplate (`main.ts`, `router/`, `App.vue`) to bring SonarCloud new-code coverage above the 80% quality gate threshold (#77)
- E2E: reduce `streaming-indicator` poll interval to 100ms and use a longer prompt in the "indicator appears" test to avoid a spurious miss when a short response streams in under the default 500ms `waitForExist` poll window (#77)
- E2E: hosts.spec.ts `before()` hook now waits for the connectivity tab transition to complete (`waitForDisplayed`) instead of using a fixed 300ms pause, eliminating a race condition with Vue's `<Transition mode="out-in">` (~500ms) that caused intermittent CI failures (#75)
- CI: updated all GitHub Actions to Node.js 24 runtimes (checkout v5.0.1, setup-node v5.0.0, pnpm/action-setup v4.1.0, upload-artifact v5.0.0); add `if-no-files-found: ignore` to E2E artifact upload steps; fix four TypeScript unused-variable lint warnings (#76)

### Changed
- CI: merge duplicate `test` + `coverage` jobs into single `test-and-coverage` (tests now run once with instrumentation instead of twice)
- CI: add path-based job skipping — Rust-only PRs skip Vitest/TS checks; frontend-only PRs skip Rust compilation/testing

### Removed
- Playwright e2e test suite — replaced by real desktop E2E tests running against a live Tauri process

### Added
- CL-03: API key management UI — Settings → Account now includes an API Keys panel for entering, validating, and removing an Ollama Cloud API key stored via the system keyring (Secret Service API). Key is never written to SQLite.
- CI: CodeQL Rust SAST analysis (GA since CodeQL 2.23.3, October 2025)
- CI: `dependency-review` workflow — blocks PRs introducing high-severity CVEs
- CI: `cargo-deny` — enforces license compliance, banned crates, and registry source restrictions
- CI: MSRV verification job — compiles with rust-version `1.88.0` (bumped from 1.77.2; `darling`, `image`, `serde_with`, `time` require 1.88)
- CI: `typos` spell check on source code and docs
- CI: `Swatinem/rust-cache` in all CI jobs for faster incremental Rust builds
- Release: SBOM (`alpaka-desktop-vX.Y.Z.spdx.json`) attached to GitHub Releases
- Release: SLSA Build L2 build attestations via `actions/attest-build-provenance`

### Fixed
- Release: pin `publish-aur` and `publish-apt-repo` from `ubuntu-latest` to `ubuntu-22.04`
- Release: SHA-pin `Swatinem/rust-cache@v2` in release workflow
- Security: Downgrade keyring token-found log from `INFO` to `DEBUG` to prevent cleartext-logging CodeQL alert near credential retrieval (#56)

### Internal
- Repo: Remove `alpaka-desktop-mockup/` design artefacts and `docs/superpowers/` AI-tool docs from the repository; untrack `.vscode/extensions.json`, `playwright-report/`, and `test-results/` output; extend `.gitignore` to cover `.playwright-mcp/`, `.superpowers/`, `.worktrees/` (#57)
- CI: Add explicit `permissions: contents: read` to `security-audit`, `build-check`, and `test` jobs to satisfy CodeQL `missing-workflow-permissions` rule (#56)

### Added
- CI: Dependabot config grouping all `@tauri-apps/*` NPM and `tauri*` Rust crate updates into a single PR to prevent version mismatch build failures (#14)
- CI: Add `test` job to CI pipeline — `cargo test --workspace` and `pnpm test --run` (Vitest) now gate every PR (#37)
- CI: Add `cargo fmt --check` and `cargo clippy -D warnings` to `build-check` job (#42)
- CI: Add `pnpm lint:check` and `pnpm format:check` to `build-check` job; add corresponding non-mutating scripts to `package.json` (#43)
- CI: Add CodeQL workflow for static security analysis of TypeScript/Vue frontend, scheduled weekly (#49)
- CI: Add `github-actions` ecosystem to Dependabot for automated action version updates (#45)
- CI: Add concurrency cancellation blocks to `ci.yml` and `claude-code-review.yml` (#46)
- CI: Extend CI push triggers to cover `release/*` and `hotfix/*` branches (#47)
- CI: Gate releases on CI passing — `ci-gate` pre-flight job verifies Build Check, Test, and Security Audit before any publish step runs (#38)
- CI: Enforce binary size budget (15 MB) in release pipeline via `scripts/profile.sh --no-launch`; fixed `profile.sh` to actually exit non-zero on budget failure (#50)
- CI: Enforce CHANGELOG update on PRs — advisory for `type: ci` and `type: docs` labels (#51)
- CI: Collect code coverage with Vitest (v8) and cargo-llvm-cov; upload to SonarCloud and as GitHub Actions artifacts (#53)

### Changed
- CI: Pin all GitHub Actions in `ci.yml`, `claude-code-review.yml`, `claude.yml` to full commit SHAs to eliminate supply chain risk (#39)
- CI: Replace `cargo install cargo-audit` with `taiki-e/install-action` (prebuilt binary, ~5s vs 4-5 min) (#44)
- CI: Pin `build-check`, `security-audit`, and `test` jobs to `ubuntu-22.04` to match release build environment (#48)

### Security
- CI: Add `permissions: contents: read` to `ci.yml` — remove implicit write token (#40)
- CI: Remove `id-token: write` from `claude-code-review.yml` and `claude.yml` — OIDC not required for OAuth token auth (#41)
- CI: Skip Claude code review on Dependabot PRs to avoid unnecessary API calls (#52)

---

## [1.1.1] - 2026-04-28

### Fixed
- Build: align `@tauri-apps/plugin-fs` (2.4.5→2.5.0) and `@tauri-apps/plugin-dialog` (2.6.0→2.7.0) NPM packages with Rust crate versions to fix release CI failure (#12)

---

## [1.1.0] - 2026-04-28

### Added
- Performance: Shiki syntax highlighting preloaded asynchronously after mount — eliminates first-render blocking (#6)
- Dev: resource profiling script (`scripts/profile.sh`) measuring binary size, cold start, PSS memory, idle CPU against architecture budgets (#6)

### Fixed
- Chat: thinking block can now be collapsed/expanded while the LLM is still thinking (#7)
- Chat: web search results are collapsed by default when search completes; user can expand manually (#8)
- Chat: auto-scroll no longer freezes after manually scrolling up then back down (#9)
- Chat: auto-scroll now works correctly when opening a saved conversation after restart (#9)
- Chat: switching conversations always resets scroll to bottom (#9)
- Models: cloud model "Run" button now correctly fetches tags and opens the tag selector (#5)

---

## [1.0.1] - 2026-04-27

### Added
- CI: publish to AUR and GitHub Pages APT repo on release

### Fixed
- AUR: install actual Tauri binary instead of AppRun wrapper
- Release: use derived fingerprint for GPG sign and export
- Release: handle base64 SSH key and missing repo context
- Release: strip CRLF from SSH/GPG keys, fix ownertrust exit code
- Release: fix SSH key newline and GPG import robustness
- Release: remove secrets from job-level if conditions
- CI: remove conflicting `libappindicator3-dev` on Ubuntu 22.04
- CI: scope pnpm audit to prod deps only
- CI: fix pnpm version conflict and audit deny policy

### Documentation
- Accurate Arch Linux install instructions with real AUR sha256sum
- Use `.asc` key format for Ubuntu 22.04+ / gpg 2.4+ compatibility
- Single-line apt setup commands to avoid copy-paste line-break issues

---

## [1.0.0] - 2026-04-22

### Added
- Initial public release
- Vue 3 + Tauri v2 desktop client for Ollama on Linux (Arch / KDE Plasma 6 / Wayland)
- Multi-host Ollama connection management with health monitoring
- Streaming chat with `<think>` block detection and tool-call support
- SQLite conversation history with folder organisation
- Model library browser with pull/delete/show info
- Markdown rendering with Shiki syntax highlighting and KaTeX math
- Secret Service keyring integration for API key storage
- System tray icon, desktop notifications, systemd service control
- AUR package (`alpaka-desktop-bin`)
- Debian/Ubuntu APT repository via GitHub Pages
- Playwright e2e test suite and Vitest frontend unit tests

---

[Unreleased]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nikoteressi/alpaka-desktop/releases/tag/v1.0.0
