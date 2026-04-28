# Changelog

All notable changes to Alpaka Desktop are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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

[Unreleased]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nikoteressi/alpaka-desktop/releases/tag/v1.0.0
