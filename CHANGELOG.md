# Changelog

All notable changes to Alpaka Desktop are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- Removed unused dependencies: `@types/lodash.throttle`, `ts-node` (frontend), `tracing-subscriber` (backend)

---

## [1.2.0] - 2026-05-02

### Added
- Conversation search — press `Ctrl+K` or the search icon to filter conversations by title
- `Ctrl+M` opens the model switcher from anywhere
- Drag images or text files directly into the chat input to attach them
- Fixed-seed input in Advanced Options for reproducible AI responses
- Mirostat v1/v2 sampling controls in Advanced Options — mode, tau, and eta; top-p/top-k hide when Mirostat is active
- Custom stop sequences in Settings → Advanced (up to 4 tokens, e.g. `###`, `<END>`)
- Per-model default generation settings — each model stores its own temperature, context window, and more; auto-applied on selection
- Per-conversation generation presets — four built-ins (Creative, Balanced, Precise, Code) plus user-defined, saved per conversation
- Create and edit custom Ollama models from a Modelfile in-app, with streaming progress and cancellation
- Configurable Ollama model storage path in Settings → Engine (writes a systemd override and restarts Ollama)
- Model tags and favorites — star models, apply text tags, and filter by tag in the model list and selector
- Ollama Cloud API key management in Settings → Account — stored securely in the system keyring, never written to the database
- Documentation site at https://nikoteressi.github.io/alpaka-desktop

### Fixed
- `Shift+Enter` now inserts a newline instead of submitting
- `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo in the chat input (custom history stack, compatible with Vue and WebKitGTK/Wayland)
- `Ctrl+Shift+C` copies the last assistant response even when the chat input is focused
- `Ctrl+H` navigates directly to the Hosts/Connectivity settings tab
- Security: cloud host detection now uses URL hostname parsing instead of substring matching, preventing subdomain-prefix attacks
- Security: API key is no longer logged at INFO level near credential retrieval

### Removed
- `Ctrl+V` paste — was broken on WebKitGTK/Wayland; drag-drop replaces it

---

## [1.1.1] - 2026-04-28

### Fixed
- Build: align `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog` NPM package versions with Rust crate versions to fix a release CI failure

---

## [1.1.0] - 2026-04-28

### Added
- Shiki syntax highlighting preloaded in the background after mount — eliminates first-render blocking

### Fixed
- Thinking block can be collapsed/expanded while the model is still streaming
- Web search results are collapsed by default; expand manually
- Auto-scroll no longer freezes after scrolling up and back down
- Auto-scroll works correctly when reopening a saved conversation after restart
- Switching conversations always resets scroll to the bottom
- Cloud model "Run" button correctly fetches tags and opens the tag selector

---

## [1.0.1] - 2026-04-27

### Added
- Publish to AUR and GitHub Pages APT repo on release

### Fixed
- AUR: install actual Tauri binary instead of AppRun wrapper
- Release pipeline: GPG/SSH key handling and signing robustness

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
- AUR package (`alpaka-desktop-bin`) and Debian/Ubuntu APT repository

---

[Unreleased]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nikoteressi/alpaka-desktop/releases/tag/v1.0.0
