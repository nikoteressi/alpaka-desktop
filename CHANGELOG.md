# Changelog

All notable changes to Alpaka Desktop are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Host Manager quick-switch (#155): `Ctrl+H` opens/closes the Host Manager modal from anywhere; modal uses `BaseModal` with CSS variables; other shortcuts are suppressed while it is open
- Arrow-key navigation in model selector: `↑`/`↓` move through installed models, `Enter` selects, `Escape` closes; `Ctrl+M` is suppressed when the model selector is already open
- In-place chat compaction (#158): compact button always visible (not gated on 70% context); messages soft-archived with `is_archived` flag; streaming summary saved as `compact_summary` message in the same conversation; streaming status bar shows tokens as they arrive with a Cancel button; sidebar spinner when compacting a background conversation; desktop notification on completion; expandable "Show history" toggle on the summary bubble; "Compaction model" setting in Settings → General
- DeepSeek-inspired chat visual styling (#149): thinking blocks now render as a collapsible timeline with step-by-step reasoning, animated brain icon, dot markers, and auto-collapse after generation; web search shown as an inline pill inside the timeline during streaming, then as a post-message favicon-stack badge that opens a 320 px source sidebar (`SearchSidebar.vue`); `chat:tool-reading` Tauri event streams preview results before the LLM finishes reading
- `MessageActions.vue` — copy, edit, regenerate, like/dislike, and version-switcher controls per message; shown on hover
- Message branching (#150): regenerate an assistant response to create an alternative version; navigate between versions with `<` / `>` controls and a `1/N` counter directly in the message bubble (`useVersionSwitcher` composable)
- `regenerate_message` Tauri command — streams a new assistant response as a sibling branch of the existing message
- `switch_version` Tauri command — activates a sibling message, updating the active conversation path
- `truncate_from` Tauri command — removes a message and all its descendants (used by edit-message to reset from the edited point)
- History stripping: `<think>` and `<tool_call>` blocks are stripped from assistant messages before they are included in LLM history context (`strip_history_content` in `services/chat/mod.rs`)

### Changed
- Edit message now calls `truncate_from` before setting the draft, so the conversation resets cleanly from the edited point instead of appending after stale messages
- Like, Dislike, and Share buttons removed from `MessageActions.vue`

### Fixed
- `message.id` was always `undefined` in the store message mapping, causing edit/index lookups to silently fail
- `--bg-elevated-rgb` CSS variable was undefined, breaking `rgba()` usage in `SearchBlock.vue` and `MessageActions.vue`
- Comprehensive `.rendered-markdown` typography stylesheet — Tailwind v4 Preflight stripped all browser defaults; headings, lists, inline code, blockquotes, and links now render correctly without `@tailwindcss/typography`

---

## [1.3.0] - 2026-05-06

### Added
- CL-04: Private model push/pull sync — "Mine" tab in Models page lists local `username/`-namespaced models; "Push to Cloud" button in model details streams upload progress via `model:push-*` events; "Pull a private model" input lets users pull by name; namespace naming hint in Create Model page guides naming for cloud push
- MO-09: Model update notifications — background digest check every 6 h detects newer versions on ollama.com/library; Models nav item shows an update count badge; each outdated model shows an amber "Update" badge and a one-click re-pull button
- G-05: GPU layer offloading configuration — Settings → Engine tab now has a "GPU Layers" input (`num_gpu`). Set to `-1` for auto (all layers), `0` for CPU-only, or any positive integer for partial offloading. Current GPU/VRAM is shown as a guide. The G-01 hardware display on the Models page reflects the configured offloading mode.
- HTTP/SOCKS5 proxy support — configure a proxy URL, optional username, and password (stored in the system keyring) in Settings → Connection; a "Test proxy" button verifies end-to-end connectivity

### Changed
- Pre-release V1.3.0 cleanup: cleared all 26 open SonarCloud findings on `main`; refactored cognitive-complexity hotspots in `useKeyboard` (shortcut registry, complexity 27→6), `MessageBubble` (parser extracted to `src/lib/messageParser.ts`, complexity 29→~8), and `chat` store (`finalizeStreamedMessage` 10-param signature collapsed to a stats object); split monolithic `ChatInput.vue` (extracted `ChatInputComposer`), `ModelsPage.vue` (extracted `views/models/` tab components), and `SettingsPage.vue` (extracted `views/settings/` tab components); dramatically expanded unit and E2E coverage
- Removed personal-email fallback in `AccountSettings.vue` — display now shows `—` when no email is set

### Fixed
- Cancelling generation (Stop button or Esc) no longer emits `chat:done`, persists a partial message to the database, or triggers a completion notification; partial content is preserved in-session via the new `chat:cancelled` event
- Esc key now correctly clears the streaming indicator (previously `isStreaming` stayed true after pressing Esc)
- Network chunk errors mid-stream no longer emit a duplicate `chat:done` or persist the partial response as a completed message
- Draft message input is now correctly saved to the database; IPC parameter casing mismatch (`conversation_id`/`draft_json` → `conversationId`/`draftJson`) prevented persistence silently
- Clearing a draft on an unsaved conversation no longer logs "Conversation not found" warnings
- Linked file context (text files attached via "Link File Context") is now correctly passed to the model; non-UTF-8 and permission-denied files previously returned empty content silently
- File link errors in the chat input now show the actual backend error message instead of a generic fallback
- E2E tests (`wdio run`) were crashing with `Failed to match capabilities` after Dependabot bumped `@wdio/local-runner`, `@wdio/mocha-framework`, `@wdio/types`, and `webdriverio` to v9 while `@wdio/cli` and `@wdio/spec-reporter` remained on v8; all wdio packages are now uniformly on v9.27.1

### Security
- Tauri capability narrowed from broad `fs:allow-read-file` to a scoped `read_image_file` command with an extension allowlist (`jpg`, `jpeg`, `png`, `gif`, `webp`, `bmp`) and 20 MB size guard; unused `opener:allow-open-path` capability removed

---

## [1.2.1] - 2026-05-04

### Security
- API key is now restricted to `https://api.ollama.com` only: `is_cloud_host` requires HTTPS scheme, preventing the key from being attached to plaintext HTTP connections; `validate_api_key` rejects any host that is not the cloud endpoint before reading the key from the keyring

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

[Unreleased]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.2.1...v1.3.0
[1.2.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nikoteressi/alpaka-desktop/releases/tag/v1.0.0
