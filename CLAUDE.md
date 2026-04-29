# CLAUDE.md (Alpaka Desktop)

## Keeping This File Current

When you add or remove commands, stores, composables, Tauri commands, or make any structural change to the codebase, update the relevant section of this file before closing the task.

## AI Tool Rules

**Do NOT create AI tool artifact files inside `docs/` or other source tree directories.**
- `docs/superpowers/` — banned
- Any `docs/<tool-name>/` subdirectory — banned

**Superpowers** specs, plans, and design docs must be written to **`.superpowers/`** (project root, git-ignored).

If a skill or tool instructs you to write a spec/plan/design doc and no path is specified, use `.superpowers/`.

## Project Overview

**Alpaka Desktop** — a native Tauri v2 desktop client for Ollama, targeting Arch Linux / KDE Plasma 6 / Wayland. Goal: feature parity with the official Windows Ollama desktop app, but on Linux.

## Commands

### Frontend (Vue 3 + TypeScript)
```bash
pnpm dev          # Start dev server with hot reload
pnpm build        # TypeScript check + production bundle
pnpm test         # Run Vitest tests
pnpm test:watch   # Run tests in watch mode
pnpm typecheck    # Type-check only
pnpm lint         # ESLint fix
pnpm format       # Prettier format
```

### Rust Backend (Tauri v2)
```bash
cargo test                    # Run all backend integration tests
cargo test <test_name>        # Run a single test
cargo build --release         # Build optimized binary
```

### Full App
```bash
pnpm tauri dev    # Launch Tauri dev app (hot reload frontend + Rust rebuild)
pnpm tauri build  # Bundle distributable app
```

## Architecture

The app is a Tauri v2 process with a Vue 3 SPA frontend and a Rust backend communicating over Tauri IPC.

**Communication patterns:**
- **Frontend → Backend:** `invoke('command_name', payload)` — synchronous request/response
- **Backend → Frontend:** `app.emit('event:name', payload)` / `listen()` — streaming and async notifications

### Critical: Streaming Chat Flow
Token streaming path: Ollama NDJSON stream → `src-tauri/src/ollama/streaming.rs` (parses chunks, detects `<think>` tags, detects tool calls) → emits `chat:token` / `chat:thinking-token` / `chat:done` Tauri events → `src/composables/useStreamingEvents.ts` → `useStreaming.ts` accumulates tokens → Pinia `chat` store → reactive Vue rendering.

### Backend Structure (`src-tauri/src/`)
- `lib.rs` — App initialization, Tauri setup, command registry (36 commands)
- `state.rs` — `AppState` shared across all Tauri commands (DbConn, HTTP client, cancel_tx, health loop handles)
- `commands/` — Tauri IPC handlers: `chat.rs`, `models.rs`, `model_user_data.rs`, `hosts.rs`, `auth.rs`, `settings.rs`, `folders.rs`, `service.rs`, `library.rs`, `system_info.rs`, `system.rs`, `model_path.rs`
- `services/` — Business logic: `chat.rs` (ChatService), `prompt.rs` (PromptService), `search.rs` (WebSearchService), `library.rs` (LibraryService)
- `db/` — SQLite via rusqlite: `migrations.rs` (single baseline `001_init_v1.sql`), one file per table, `repo.rs`
- `ollama/` — HTTP client with multi-host routing (`client.rs`), NDJSON stream parsing (`streaming.rs`), web search (`search.rs`)
- `auth/` — Secret Service / keyring integration (`keyring.rs`)
- `system/` — Tray icon, desktop notifications, systemd service control

### Frontend Structure (`src/`)
- `stores/` — Pinia stores: `chat.ts`, `models.ts`, `hosts.ts`, `settings.ts`, `auth.ts`
- `views/` — `ChatPage.vue`, `LaunchPage.vue`, `ModelsPage.vue`, `SettingsPage.vue`
- `composables/` — 23 composables including: `useStreaming.ts`, `useStreamingEvents.ts`, `useSendMessage.ts`, `useConversationLifecycle.ts`, `useAppOrchestration.ts`, `useDraftManager.ts`, `useContextWindow.ts`, `useAttachments.ts`, `useModelLibrary.ts`, `useAutoScroll.ts`, `useKeyboard.ts`, `useTheme.ts`, `useCollapsibleState.ts`, `useConfirmationModal.ts`, `useCopyToClipboard.ts`, and more
- `lib/markdown.ts` — markdown-it + Shiki (syntax highlighting) + KaTeX (math) pipeline

### Key Events (Backend → Frontend)
| Event | Payload | Purpose |
|-------|---------|---------|
| `chat:token` | `{ conversation_id, content }` | Streaming text token |
| `chat:thinking-start` | `{ conversation_id }` | `<think>` tag opened |
| `chat:thinking-token` | `{ conversation_id, content }` | Token inside `<think>` block |
| `chat:thinking-end` | `{ conversation_id }` | `</think>` tag closed |
| `chat:done` | `{ conversation_id, tokens_per_sec? }` | Stream complete |
| `chat:error` | `{ conversation_id, error }` | Stream or generation error |
| `chat:tool-call` | `{ conversation_id, tool_name, arguments }` | LLM requested tool call |
| `chat:tool-result` | `{ conversation_id, tool_name, result }` | Tool call result |
| `model:pull-progress` | `{ model, status, percent? }` | Download progress |
| `model:pull-done` | `{ model }` | Download complete |
| `host:status-change` | `{ host_id, status, latency_ms? }` | Health ping result |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3 (Composition API), Pinia, TypeScript, TailwindCSS v4, Vue Router |
| Markdown | markdown-it + Shiki + KaTeX |
| Backend | Rust, Tauri v2, Tokio, reqwest (streaming), rusqlite |
| Auth | keyring (Secret Service API) |
| Tests | Vitest (frontend), cargo integration tests (backend), Playwright (e2e in `/e2e`) |

## Code Style

- **Vue:** Composition API only (`<script setup>`), no Options API
- **Comments:** Default to none. Only comment when the WHY is non-obvious — a hidden constraint, a workaround, a subtle invariant. Never describe what the code does.
- **TailwindCSS v4** — not v3. Config is CSS-based in `src/style.css` (`@import "tailwindcss"`), no `tailwind.config.js`. Utility names differ from v3 in places.
- **TypeScript:** strict mode; no `any`. Prefer narrowing over casting.

## Workflow

### Pre-push gate (mandatory)
```bash
pnpm format && pnpm test   # must both pass before git push
```

### GitFlow branching
| Task | Branch prefix | Base branch |
|------|--------------|-------------|
| New feature | `feature/name` | `develop` |
| Non-critical bug | `bugfix/name` | `develop` |
| Critical hotfix | `hotfix/name` | `main` |

PRs target `develop` (features/bugfixes) or `main` (hotfixes). Hotfix merges to `main` must also back-merge into `develop`.

### Issue-first workflow
1. Create a GitHub issue (`gh issue create`) with label + milestone before writing any code
2. Open PR with `Closes #N` in the body to auto-close the issue on merge
3. Update `CHANGELOG.md` under `[Unreleased]` for every user-visible change

## Architecture Reference

`docs/ARCHITECTURE.md` contains exhaustive detail: full command registry, complete SQLite schema, service layer docs, ADRs, event catalog, security model, and performance budget. Read it before making structural changes.

`docs/PRODUCT_SPEC.md` contains the feature matrix, UX philosophy, keyboard shortcuts, and milestone roadmap.
