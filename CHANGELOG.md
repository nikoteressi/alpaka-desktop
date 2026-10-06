# Changelog

All notable changes to Alpaka Desktop are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed
- The context length set in Settings → Engine is now actually used (#233). Every preset, built-in and custom, carried its own `num_ctx` (4096 or 8192) that silently overrode it, and there was no control to change it. Presets now cover sampling options only; `num_ctx` is dropped from custom presets saved by older versions

### Changed
- `vue-router` 4 → 5, `notify-debouncer-mini` 0.3 → 0.7 (folder auto-refresh watcher), `tokio` 1.53.2, and CI action pins (`dtolnay/rust-toolchain`, `Swatinem/rust-cache`, `taiki-e/install-action`)
- Dependabot version-update PRs now target `develop` instead of `main`, so dependency bumps follow the normal GitFlow path

### Removed
- Unused `@vueuse/core` dependency

---

## [1.4.0] - 2026-10-06

### Security
- `katex` 0.16 → 0.18.11 (math rendering) for GHSA-238p-pmpm-9mq7; `@types/katex` dropped since KaTeX now ships its own types

### Fixed
- Attached images and search-result favicons now carry `alt` text (accessibility), plus SonarQube code-quality fixes: simpler thinking-block status logic and citation parser, a duplicate CSS rule, an unhandled refresh promise, and duplicate imports
- `pnpm typecheck` (and the type-check step of `pnpm build`) checked nothing: the root `tsconfig.json` has `files: []`. Both now run against `tsconfig.app.json`, and the 14 type errors this exposed are fixed (unused bindings, test fixtures missing required fields or branded `ModelName` types, a `null` favicon URL bound to `<img src>`)
- Tool-chain regeneration now creates a proper dispatch sibling, fixing broken version navigation when regenerating a web-search response (#167)
- L-07/L-08: Wire `ErrorScreen.vue` into `App.vue` — connection error overlay now appears when the active Ollama host goes offline, with Retry, Start Ollama Service (localhost only), and Change Host / Settings actions
- `message.id` was always `undefined` in the store message mapping, causing edit/index lookups to silently fail
- `--bg-elevated-rgb` CSS variable was undefined, breaking `rgba()` usage in `SearchBlock.vue` and `MessageActions.vue`
- Comprehensive `.rendered-markdown` typography stylesheet — Tailwind v4 Preflight stripped all browser defaults; headings, lists, inline code, blockquotes, and links now render correctly without `@tailwindcss/typography`

### Added
- Settings → Maintenance shows a notice when the database key is kept in the `db.key` fallback file because no system keyring was available
- LFC-05: Auto-refresh folder context — per-context toggle enables inotify watcher; token count updates on file change with ↻ pill flash
- LFC-03: Clicking a linked folder context pill opens a file picker modal — users can select which files are included as LLM context. Unchecking all files and applying removes the folder link.
- C-08/C-08b: Conversation export via sidebar context menu — right-click a conversation → Export → JSON or Markdown; dialog pre-filled with conversation title as default filename; Markdown export strips `<think>` and `<tool_call>` blocks for clean output (#156)
- Host Manager quick-switch (#155): `Ctrl+H` opens/closes the Host Manager modal from anywhere; modal uses `BaseModal` with CSS variables; other shortcuts are suppressed while it is open
- Arrow-key navigation in model selector: `↑`/`↓` move through installed models, `Enter` selects, `Escape` closes; `Ctrl+M` is suppressed when the model selector is already open
- In-place chat compaction (#158): compact button always visible (not gated on 70% context); messages soft-archived with `is_archived` flag; streaming summary saved as `compact_summary` message in the same conversation; streaming status bar shows tokens as they arrive with a Cancel button; sidebar spinner when compacting a background conversation; desktop notification on completion; expandable "Show history" toggle on the summary bubble; "Compaction model" setting in Settings → General
- DeepSeek-inspired chat visual styling (#149): thinking blocks now render as a collapsible timeline with step-by-step reasoning, animated brain icon, dot markers, and auto-collapse after generation; web search shown as an inline pill inside the timeline during streaming, then as a post-message favicon-stack badge that opens a 320 px source sidebar (`SearchSidebar.vue`); `chat:tool-reading` Tauri event streams preview results before the LLM finishes reading
- `MessageActions.vue` — copy, edit, regenerate, like/dislike, and version-switcher controls per message; shown on hover
- Message branching (#150): regenerate an assistant response to create an alternative version; navigate between versions with `<` / `>` controls and a `1/N` counter directly in the message bubble (`useVersionSwitcher` composable)
- `regenerate_message` Tauri command — streams a new assistant response as a sibling branch of the existing message
- `switch_version` Tauri command — activates a sibling message, updating the active conversation path
- `truncate_from` Tauri command — removes a message and all its descendants (used by edit-message to reset from the edited point)
- History context now uses native DB fields — `thinking` sent back as `message.thinking`, tool calls via `tool_calls_json`, tool results as `role=tool` messages; no XML stripping at replay time

### Changed
- Rust dependencies brought up to the versions already shipped on `main` (tokio 1.53, uuid 1.26, serde 1.0.229, Tauri plugins and others), which earlier back-merges had left behind on `develop`
- CI: clippy now also lints the production feature set (the `test-mode` build compiles out the keyring and background-loop code)
- Dev tooling: TypeScript 5.9 → 6.0 (type checking only; no change to the built app)
- Thinking content now stored in native `thinking` DB column; no longer embedded as `<think>` XML in `content`
- Tool-call exchanges stored as chained DB messages (`role=assistant/tool_calls` → `role=tool` → `role=assistant/final`); no longer embedded as `<tool_call>` XML
- One-time startup migration backfills all existing messages to native format
- Edit message now calls `truncate_from` before setting the draft, so the conversation resets cleanly from the edited point instead of appending after stale messages
- Like, Dislike, and Share buttons removed from `MessageActions.vue`
- Dev tooling: vitest 2.1 → 4.1 and vite 6 → 8 (test and build toolchain only; no app behaviour change); `pnpm typecheck` now also type-checks `vite.config.ts` (`tsconfig.node.json`)

### Removed
- `strip_history_content` function and all XML-parsing code from both Rust and frontend
- `<think>` and `<tool_call>` regex branches from `messageParser.ts`

---

## [1.3.3] - 2026-10-06

### Fixed
- The app no longer crashes at startup when no system keyring (Secret Service) is available, e.g. on minimal window managers or in sandboxes. A fresh install without a keyring now keeps its database key in a private `db.key` file (mode 0600) in the app data directory, with a warning in the log. An existing keyring-encrypted database is never re-keyed; if the keyring is down, startup reports a clear error instead

---

## [1.3.2] - 2026-10-06

### Changed
- CI: GitHub Actions pins updated: actions/checkout 7.0.1, actions/setup-node 7.0.0, actions/attest-build-provenance 4.2.2, pnpm/action-setup 6.1.0, anchore/sbom-action 0.24.2, softprops/action-gh-release 3.0.3, taiki-e/install-action 2.87.21

### Fixed
- AppImage: the bundled `AppRun.wrapped` launcher is now world-executable (it was packaged root-owned with mode 0770, so the AppImage could not start for non-root users and AppImageHub's test failed with "Permission denied"); the release workflow now pre-seeds Tauri's AppRun with mode 0755 and fails the build if any file in the AppImage is not usable by other users

### Security
- `source-map-js` 1.2.2 (transitive via the Vue compiler) for GHSA-68fv-2mgg-jv7q
- Dev tooling: `postcss-selector-parser` 7.1.6 (used only by eslint-plugin-vue) for GHSA-rj75-hqrm-r3gf, which has no 6.x fix; not shipped in the app
- Resolved CodeQL `rust/cleartext-logging` finding in the API-key tests (test assertions no longer format results from the API-key code path; no runtime change)
- Dev tooling: patched transitive dependencies of the E2E runner (WebdriverIO), eslint, vitest UI and VitePress via `pnpm.overrides`: undici 7.30, js-yaml 4.3.2, postcss 8.5.29, nanoid 3.3.18, basic-ftp 6.2.2, @humanfs/node 0.16.8, fflate 0.8.3, postcss-selector-parser 6.1.4; Rust `anyhow` 1.0.104 and `event-listener` 5.4.2 (RUSTSEC-2026-0190, RUSTSEC-2026-0221). None of these ship in the app
- Dev tooling: `brace-expansion` pinned to patched releases (1.1.21 / 2.1.7 / 5.0.12) for GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895, GHSA-6j4f-fj2g-mc7p and GHSA-qhr7-859c-m2p7; not shipped in the app
- `dompurify` 3.4.2 → 3.4.16 (Markdown HTML sanitizer), picking up the upstream fixes released since 3.4.2

### Removed
- Unused `ed25519-dalek` Rust dependency (and 10 crypto crates it pulled in)

---

## [1.3.1] - 2026-10-05

### Fixed
- AppImage: `.DirIcon` is now a relative symlink instead of an absolute path into the CI build directory, so the app icon resolves on users' machines and the AppImage passes AppImageHub validation (`@tauri-apps/cli` 2.11.2 → 2.11.5, tauri-apps/tauri#15596)

### Security
- Consolidated dependency update picking up upstream security fixes: `tauri` 2.11.6, `markdown-it` 14.3.2, `vue` 3.5.43 (patched `postcss`/`nanoid`), and Rust lockfile updates clearing open RustSec advisories (`quinn-proto`, `h2`, `rustls`, `crossbeam-epoch`, `quick-xml`, `rkyv`); bundled SQLCipher engine updated to 4.14.0 via `rusqlite` 0.40.2

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

[Unreleased]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.3.3...v1.4.0
[1.3.3]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.2.1...v1.3.0
[1.2.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/nikoteressi/alpaka-desktop/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nikoteressi/alpaka-desktop/releases/tag/v1.0.0
