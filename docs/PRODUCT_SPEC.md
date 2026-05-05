# Alpaka Desktop — Linux Native Client

> **Product Specification v1.2.0** — 2026-05-04
> Target: Linux (primary: Arch Linux · KDE Plasma 6 · Wayland)
> Companion to [ARCHITECTURE.md](ARCHITECTURE.md)

> **Status legend:** ✅ Implemented & wired in UI · ⚠️ Partial / works with caveats ·
> 🟡 Backend implemented but not exposed in UI · 🔲 Backlog · ❌ Not implemented

---

## 1. Vision & Purpose

### 1.1 Problem Statement

Ollama's official desktop application is available for macOS and Windows but lacks a native Linux client. Linux power users — particularly those on KDE Plasma 6 / Wayland — are limited to the CLI, third-party web UIs, or Electron wrappers that feel alien to the desktop environment.

### 1.2 Product Vision

A **first-class, lightweight Linux desktop client** for Ollama that:

- Delivers full feature parity with the Windows/macOS desktop app
- Mirrors the clean, sleek, modern look of the official Ollama Windows app
- Runs as a Tauri v2 native app with a Rust backend — no Electron bloat
- Integrates with the Linux desktop (system tray, Wayland, xdg-portal)
- Provides a premium, modern chat experience with smooth streaming and polished UI

### 1.3 Target Users

| Persona | Description |
|---|---|
| **Power Dev** | Software developer running local LLMs for coding assistance, code review, and document analysis |
| **AI Researcher** | ML/AI practitioner experimenting with open-weight models, comparing outputs, tuning parameters |
| **Privacy-First User** | User who wants ChatGPT-class UX without sending data to third-party clouds |
| **Tinkerer** | Arch Linux / KDE enthusiast who values native look-and-feel and system integration |

### 1.4 Success Criteria

- Full functional parity with the Ollama Windows desktop app
- UI visually matches the clean, modern aesthetic of the official Ollama Windows client
- Tauri v2 native window with Wayland support
- Linux system tray integration (KDE, GNOME, Hyprland)
- Sub-100ms input-to-first-token-rendered latency (local models)
- AUR package available for Arch Linux

---

## 2. Feature Specification

### 2.1 Core Chat Interface

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| C-01 | **Multi-turn chat** | P0 | ✅ | Persistent conversation threads with full history |
| C-02 | **Streaming text rendering** | P0 | ✅ | Token-by-token display via `chat:token` Tauri events with typing cursor |
| C-03 | **Reasoning/thinking blocks** | P0 | ✅ | Collapsible `<think>` panels with console-style rendering and pulsing border (`ThinkBlock.vue`) |
| C-04 | **Markdown rendering** | P0 | ✅ | Full GFM via `markdown-it` + KaTeX (`lib/markdown.ts`) |
| C-05 | **Code blocks with copy button** | P0 | ✅ | Language detection, Shiki syntax highlighting, one-click copy (`CodeBlock.vue`) |
| C-06 | **Chat history persistence** | P0 | ✅ | SQLite-backed; pin, rename, delete, and search by title (`Ctrl+K` inside `ConversationList.vue`) |
| C-07 | **Multi-chat tabs/panels** | P1 | 🔲 Backlog | Side-by-side or tabbed conversations |
| C-08 | **Chat export to JSON** | P1 | 🟡 | `export_conversation` Tauri command implemented and exposed in `lib/tauri.ts`, but no UI button calls it |
| C-08b | **Chat export to Markdown** | P1 | 🔲 Backlog | Not implemented in backend or UI |
| C-09 | **Chat branching** | P2 | 🔲 Backlog | Fork conversation at any message |
| C-10 | **Chat backup & restore** | P1 | ⚠️ | Raw SQLite backup/restore wired in `Settings → Maintenance`; no per-conversation JSON import/export UI |
| C-11 | **Compact / TWM mode** | P1 | ⚠️ | `Ctrl+Shift+M` collapses the 48 px icon strip (`App.vue:14`). Padding, font sizes and the top-bar layout described in §3.6 are **not** implemented |
| C-12 | **Conversation summarisation (Compact)** | P1 | ✅ | Button at ≥70 % context usage; summarises history with `temperature=0.3`, creates a new conversation with the summary as a system prompt + last 4 turns (`services/chat/compact.rs`) |
| C-13 | **Sliding-window context truncation** | P0 | ✅ | Automatic on every send; trims oldest user/assistant messages to fit `0.85 × num_ctx` (`services/chat/context.rs`) |
| C-14 | **Stop generation** | P0 | ✅ | `Escape` key + Send button toggles to "Stop" while streaming; cancel via `tokio::broadcast` channel |
| C-15 | **Drafts per-conversation** | P1 | ✅ | Input + advanced options auto-saved per conversation (`useDraftSync`) |
| C-16 | **Undo/redo in chat input** | P1 | ✅ | Custom history stack (`Ctrl+Z` / `Ctrl+Shift+Z`); needed because WebKitGTK on Wayland doesn't drive native undo |

### 2.2 Multimodal Input

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| M-01 | **Image input** | P0 | ✅ | File picker (Attach Images menu) + drag-drop. Up to 10 images × 20 MB each |
| M-02 | **Text-file drag-and-drop** | P0 | ✅ | Dropping non-image files calls `link_folder` and ingests them as folder context (`useAttachments.ts:85`) |
| M-03 | **Document preview** | P1 | ⚠️ | Image thumbnails via `AttachmentList.vue`; no preview for PDFs or text files (they go through folder-context pill instead) |
| M-04 | **Clipboard image paste** | P0 | ❌ Removed | `Ctrl+V` was removed in v1.2.0 — was broken on WebKitGTK/Wayland; drag-drop replaces it. No `paste` event handler exists in code |
| M-05 | **Audio input** | P2 | 🔲 Backlog | Whisper-based speech-to-text |

### 2.3 Model Management

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| MO-01 | **Browse local models** | P0 | ✅ | List with size, family, quantization, parameter count (`commands/models.rs::list_models`) |
| MO-02 | **Search Ollama library** | P0 | ✅ | Search `ollama.com/library` via `services/library.rs`; `LibraryBrowser.vue` |
| MO-03 | **Download/pull models** | P0 | ✅ | Progress bar via `model:pull-progress` events (`ModelsPage.vue:718`) |
| MO-04 | **Delete models** | P0 | ✅ | Confirmation modal, size indicator (`ModelsPage.vue:729`) |
| MO-05 | **Model details view** | P0 | ✅ | Capabilities, README, tags (`LibraryModelDetails.vue`, `LocalModelDetails.vue`) |
| MO-06 | **Custom model creation** | P1 | ✅ | Create / edit from Modelfile with streaming progress and cancellation (`CreateModelPage.vue`, `commands/model_create.rs`). Reachable via "Create model" button on Models page |
| MO-07 | **Model tags / favorites** | P1 | ✅ | Star + free-form tags; filter by tag in model list and selector (`model_user_data.rs`) |
| MO-08 | **Configurable storage path** | P0 | ✅ | `Settings → Engine`; writes a systemd override and restarts Ollama (`ModelPathSettings.vue`, `commands/model_path.rs`) |
| MO-09 | **Model update notifications** | P1 | ✅ | Background check every 6 h compares local digest vs `ollama.com/library` hash; nav badge + per-card "Update" indicator; one-click re-pull (`services/model_updates.rs`, `stores/models.ts`) |
| MO-10 | **Cloud model run** | P0 | ✅ | Cloud tags (`:cloud` suffix) recognised; `addCloudModel` registers the model (`stores/models.ts`) |

### 2.4 Ollama Cloud Integration

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| CL-01 | **User authentication** | P0 | ✅ | `ollama signin` OAuth flow with polling-based status check (`AccountSettings.vue`, `auth/oauth.rs`) |
| CL-02 | **Cloud model access** | P0 | ✅ | Run models hosted on Ollama Cloud |
| CL-03 | **API key management** | P0 | ✅ | UI panel with input, visibility toggle, validate, delete; key stored via Secret Service (`ApiKeyPanel.vue`, `auth/api_key.rs`) |
| CL-04 | **Private model sync** | P1 | ✅ | Push local models to Ollama Cloud via `push_model` command; streaming progress events; "My Models" section in cloud tab persists private model names under settings key `private_cloud_models` (`MyModelsSection.vue`, `commands/models.rs:push_model`) |
| CL-05 | **Usage dashboard** | P1 | 🔲 Backlog | Cloud compute usage, cost tracking |
| CL-06 | **Web search integration** | P0 | ✅ | Agentic tool-call loop via Ollama Web Search API; up to 5 iterations, forces `temperature=0.2`, `top_p=0.1` (`services/chat/orchestrator.rs:89`) |

### 2.5 Context & Generation Settings

Three-layer settings architecture: **Global defaults → Per-model overrides → Per-chat
adjustments**. Custom values from the inner layer override the outer layer; absent
values fall back outward (`ChatOptions::merge_with_fallback` in `ollama/types.rs`).

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| S-01 | **Temperature slider** | P0 | ✅ | Range 0.0–2.0 |
| S-02 | **Context length slider** | P0 | ✅ | Stepped: 4k / 8k / 16k / 32k / 64k / 128k / 256k tokens |
| S-03 | **System prompt editor** | P0 | ✅ | Per-conversation, stored as system role message; `SystemPromptPanel.vue` |
| S-04 | **Top-P / Top-K** | P0 | ✅ | Hidden when Mirostat is active |
| S-05 | **Repeat penalty** | P0 | ✅ | `repeat_penalty`, `repeat_last_n` |
| S-06 | **Stop sequences** | P1 | ✅ | Up to 4 tokens (e.g. `###`, `<END>`); `StopSequencesInput.vue` |
| S-07 | **Seed control** | P1 | ✅ | Fixed seed for reproducible outputs (`AdvancedChatOptions.vue`) |
| S-08 | **Mirostat** | P1 | ✅ | Mirostat 1/2 with `tau` and `eta`; `MirostatSelector.vue` |
| S-09 | **Preset profiles** | P1 | ✅ | Built-ins: Creative / Balanced / Precise / Code; user-defined presets saved per conversation (`PresetEditor.vue`) |
| S-10 | **Per-model defaults** | P1 | ✅ | Each model stores its own options; auto-applied on selection (`useModelDefaults.ts`, `commands/model_settings.rs`) |
| S-11 | **Reasoning / think mode toggle** | P1 | ✅ | Shown only when `modelCaps.thinking_toggleable`. Boolean for binary models, `low/medium/high` levels for GPT-OSS |

### 2.6 GPU & Performance

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| G-01 | **GPU / VRAM / RAM display** | P0 | ⚠️ | `detect_hardware` reads `/proc/meminfo` + DRM sysfs and feeds into `useModelLibrary`; rendered **only on the Models page** library browser (`ModelsPage.vue:508-535`). Not surfaced anywhere else |
| G-02 | **Multi-GPU support** | P0 | ✅ | Inherited from Ollama's multi-GPU scheduling; no app-level work required |
| G-03 | **CPU fallback indicator** | P0 | ❌ | No dedicated "running on CPU" indicator in the UI |
| G-04 | **Per-message performance metrics** | P1 | ✅ | Tokens/sec, TTFT, total / load / prompt-eval / eval duration, seed, prompt_tokens — stored per message and rendered in `StatsBlock.vue` |
| G-05 | **GPU layer configuration** | P1 | ✅ | `num_gpu` layers for partial offloading. Settings → Engine tab (`GpuLayersSettings.vue`): numeric input (-1 = auto, 0 = CPU only, N = partial). VRAM shown as guide via `detect_hardware`. G-01 GPU card in Models → Engine tab shows offloading badge when `num_gpu` ≠ -1. Validated server-side in `validate_chat_options`. |

### 2.7 Networking, Hosts & Sharing

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| N-01 | **LAN mode (multi-host)** | P0 | ✅ | Multiple Ollama endpoints including LAN servers; one active at a time |
| N-02 | **Hosts Manager** | P0 | ⚠️ | Implemented inside `Settings → Connection` (`HostSettings.vue`). Standalone modal `HostManager.vue` exists but is **never imported** anywhere |
| N-03 | **Quick host switching** | P0 | ⚠️ | No top-bar dropdown — `components/shared/TopBar.vue` is a 0-byte file. Host switching reachable via `Ctrl+H` → Settings → Connection. Active-host change takes effect on the next API call (`OllamaClient` reads active host from DB on each call) |
| N-04 | **Host health indicator** | P1 | ✅ | Background ping every 30 s; `host:status-change` event (`commands/hosts.rs::start_host_health_loop`) |
| N-05 | **Proxy support** | P1 | ✅ | HTTP/SOCKS5 proxy URL + optional username/password (keyring); Test button; Settings → Connection (`ProxySettings.vue`, `commands/proxy.rs`) |
| N-06 | **Per-host bearer token** | P1 | ✅ | Optional auth token stored in keyring (never in DB) |

### 2.8 Coding Tools Integration

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| CT-01 | **`ollama launch` support** | P1 | ⚠️ | `LaunchPage.vue` is a static reference card list (Claude / Codex / OpenCode / Droid / Pi) with copyable `ollama launch <tool>` commands. No actual launching from inside the app |
| CT-02 | **Anthropic Messages API compat** | P1 | 🔲 Backlog | Local models with Claude Code–compatible tools |
| CT-03 | **Tool calling visualization** | P1 | ✅ | `chat:tool-call` and `chat:tool-result` events; `<tool_call>` markers parsed and rendered inline by `MessageBubble.vue:75` and `SearchBlock.vue` |

### 2.9 Local Folder Context (Lightweight RAG)

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| LFC-01 | **Link local directories or single files** | P1 | ✅ | Via Attach menu → "Link Folder Context" / "Link File Context", or by drag-drop. Persisted in `folder_contexts` table |
| LFC-02 | **File parsing** | P1 | ⚠️ | Reads **all text files recursively** with `ignore::WalkBuilder` (respects `.gitignore`, skips hidden files and binaries via null-byte check). No file-extension allow-list. Caps: 50 MB total, 1000 files |
| LFC-03 | **Selective file inclusion** | P1 | 🟡 | Backend commands `list_folder_files` and `update_included_files` exist and are exposed in `lib/tauri.ts`, but **no UI component calls them**. Linked folder is shown as a single removable pill, not a tree picker |
| LFC-04 | **Context size indicator** | P1 | ✅ | Token estimate (`chars / 4`) returned by `link_folder` and shown on the pill; full context bar shows `prompt_eval_count + eval_count` while streaming |
| LFC-05 | **Auto-refresh** | P2 | 🔲 Backlog | `auto_refresh` column exists in DB schema but is always `false` |
| LFC-06 | **Path safety** | P0 | ✅ | `guard_path` rejects `/proc /sys /dev /etc /root /boot /var /usr/bin /usr/sbin` and `~/.ssh /.gnupg /.aws /.kube`; canonicalise-then-prefix-check defends against traversal |

> **Design note:** No vector DB, no embedding model. Files are read, parsed to text, and
> injected into the conversation as a `<context_background>` system message at the head
> of the prompt.

### 2.10 Linux Desktop Integration

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| L-01 | **System tray** | P0 | ⚠️ | Show / Hide / Quit menu only (`system/tray.rs`); no host or model controls. Icon adapts to light/dark theme |
| L-02 | **Desktop notifications** | P1 | ✅ | `notify-rust` → D-Bus. Fires on generation complete/failed, backup success/failure, restore, model creation events |
| L-03 | **Smart-focus notifications** | P2 | ✅ | `report_active_view` tracks the currently visible page; notifications skipped when the relevant chat is already in focus |
| L-04 | **Wayland support** | P0 | ✅ | WebKitGTK 4.1 native Wayland backend |
| L-05 | **Secret Service (KWallet / GNOME Keyring / KeePassXC)** | P0 | ✅ | API keys, OAuth tokens, per-host bearers — all via `keyring` crate, never on disk |
| L-06 | **xdg-desktop-portal file dialogs** | P0 | ✅ | Tauri dialog plugin |
| L-07 | **Systemd Ollama service control** | P1 | 🟡 | `start_ollama` / `stop_ollama` / `ollama_service_status` commands implemented and exposed in `lib/tauri.ts`, but the only caller is `ErrorScreen.vue`, which itself is never imported anywhere — so currently unreachable from the UI |
| L-08 | **Connection error screen with retry** | P1 | 🟡 | `ErrorScreen.vue` exists with full retry / start-Ollama logic, but is **not wired into the router or `App.vue`**. Users currently see no friendly screen when Ollama is unreachable |
| L-09 | **Ollama model storage path override** | P1 | ✅ | `Settings → Engine` writes a systemd override and restarts Ollama (`ModelPathSettings.vue`) |

### 2.11 Backup & Maintenance

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| B-01 | **SQLite backup** | P1 | ✅ | `Settings → Maintenance → Backup`; uses SQLite online backup API (`commands/chat.rs::backup_database`) |
| B-02 | **SQLite restore** | P1 | ✅ | `Settings → Maintenance → Restore` with confirmation |
| B-03 | **Per-conversation JSON export** | P1 | 🟡 | `export_conversation` command implemented; **no UI button** invokes it |

---

## 3. User Interface Design

### 3.1 Design Philosophy

> **"Indistinguishable from the official app — just on Linux."**

The UI replicates the **clean, minimal, modern aesthetic** of the official Ollama Windows desktop app:

- **Clean white/dark surfaces** with ample whitespace
- **Proportional sans-serif typography** for all chat and UI elements
- **Rounded message bubbles**, soft shadows, smooth transitions
- **No terminal aesthetic** in the main interface

The **only exception** is the `<think>` reasoning block: monospace font, pulsing border animation, and subtle dark background. This is the sole place where console aesthetics appear.

### 3.2 Layout Architecture

```
┌─────────────────────────────────────────────────────────┐
│  ☰  Alpaka Desktop              ─ □ ✕  │ Title Bar     │
├────────────┬────────────────────────────────────────────┤
│            │  Model: llama3:70b ▼  │ ⚙ Settings │  🌐 │
│  Chat      ├────────────────────────────────────────────┤
│  History   │                                            │
│            │  ┌──────────────────────────────────────┐  │
│  ● Today   │  │  User message                        │  │
│    Chat 1  │  └──────────────────────────────────────┘  │
│    Chat 2  │                                            │
│            │  ┌──────────────────────────────────────┐  │
│  ● Yester  │  │  ⟩ Thinking...                       │  │
│    Chat 3  │  │  ▊ Streaming response...              │  │
│            │  │                                      │  │
│  ─────────│  │  ```python                           │  │
│  ☁ Cloud   │  │  def hello(): ...   [📋 Copy]        │  │
│  📦 Models │  └──────────────────────────────────────┘  │
│  ⚙ Config  ├────────────────────────────────────────────┤
│            │  📎 │ Type a message...          │ ⬆ Send │
└────────────┴────────────────────────────────────────────┘
```

### 3.3 Streaming & Visual Effects

#### Standard Chat

| Effect | Description |
|---|---|
| **Smooth word-group rendering** | Text appears in word-groups for a fluid reading experience |
| **Markdown progressive render** | Headings, lists, tables render as tokens arrive |
| **Code block streaming** | Fenced code blocks with live Shiki syntax highlighting |
| **Smooth scroll-lock** | Auto-scroll follows generation; user scroll-up pauses it |
| **Speed indicator** | "42 tok/s" badge pinned to active message during generation |

#### Console-Style Reasoning Block (`<think>` tags)

| Effect | Description |
|---|---|
| **Collapsible panel** | Default-collapsed once generation completes |
| **Monospace font** | `JetBrains Mono` / `Fira Code` at 0.85em |
| **Pulsing border** | Left border pulses with accent color while generating |
| **Dark background** | `bg-neutral-900/50` dark, `bg-neutral-100` light |
| **"Thinking..." label** | Animated ellipsis while generating; "Thought for Xs" on complete |

### 3.4 Visual Design Tokens

| Token | Value | Notes |
|---|---|---|
| **Accent Color** | `#FF6B35` (Ollama Orange) | Send button, active tabs, thinking-block border |
| **Surface — Light** | `#FFFFFF` / `#F9FAFB` | Clean, bright surfaces |
| **Surface — Dark** | `#1A1A1A` / `#0F0F0F` | True dark, not gray |
| **Font — UI & Chat** | `Inter` 400/500/600 | 15px chat, 14px UI |
| **Font — Code / Thinking** | `JetBrains Mono` / `Fira Code` | Only in code fences and `<think>` blocks |
| **Border Radius** | 12px bubbles, 16px cards, 8px buttons | Generously rounded |
| **Animations** | 150ms ease-out | Respects `prefers-reduced-motion` |

### 3.5 Keyboard Shortcuts

Implemented in `composables/useKeyboard.ts` (global) and `ChatInput.vue` (input-scoped).

| Shortcut | Action | Status |
|---|---|---|
| `Enter` | Send message | ✅ |
| `Shift+Enter` | New line in input | ✅ |
| `Ctrl+N` | New conversation | ✅ |
| `Ctrl+K` | Open conversation search (`ConversationList`) | ✅ |
| `Ctrl+M` | Open model switcher | ✅ |
| `Ctrl+,` | Open settings | ✅ |
| `Ctrl+Shift+C` | Copy last assistant response | ✅ |
| `Ctrl+/` | Toggle sidebar | ✅ |
| `Escape` | Stop generation | ✅ |
| `Ctrl+↑ / Ctrl+↓` | Navigate to previous/next conversation | ✅ |
| `Ctrl+Shift+M` | Toggle Compact mode (collapses 48 px icon strip only) | ⚠️ |
| `Ctrl+H` | Open `Settings → Connection` tab | ✅ |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / redo inside the chat input (custom history stack) | ✅ |

### 3.6 Compact / TWM Mode

> **Status:** ⚠️ Partial. Toggled via `Ctrl+Shift+M` (`settingsStore.compactMode`).
> Currently only collapses the 48 px icon strip (`App.vue:14`). The padding-, font-,
> top-bar-collapse, and minimum-width changes described below are **not yet
> implemented** and remain as design intent for tiling WM users (Hyprland, Sway, i3).

| Behaviour | Standard | Compact (target) | Compact (today) |
|---|---|---|---|
| **Icon strip** | Visible (48 px) | — | Hidden (`w-0`) ✅ |
| **Sidebar** | Visible (220 px) | Hidden; overlay via `Ctrl+/` | Unchanged |
| **Message padding** | 16 px / 12 px | 8 px / 6 px | Unchanged |
| **Top bar** | Full controls | Model name + host dot only | n/a — there is no top bar |
| **Font sizes** | 15 px / 14 px | 13 px / 12 px | Unchanged |
| **Min useful width** | ~500 px | ~320 px | ~500 px |

### 3.7 Connection Error Screen

> **Status:** 🟡 Component exists (`components/shared/ErrorScreen.vue`) with full retry +
> systemd-start logic, **but is not currently wired into the router or `App.vue`**, so
> users do not see it when Ollama is unreachable. Re-wiring it is tracked as P1.

Designed appearance:

```
┌─────────────────────────────────────────────┐
│                                             │
│             🦙                              │
│    Couldn't connect to Ollama               │
│    The server at localhost:11434             │
│    is not responding.                       │
│                                             │
│    [ 🔄 Retry Connection ]                  │
│    [ ▶ Start Ollama Service ]               │
│    [ ⚙ Change Host / Settings ]             │
│                                             │
│    curl -fsSL https://ollama.com/install.sh │
│    | sh                         [📋 Copy]   │
│                                             │
└─────────────────────────────────────────────┘
```

Designed behaviour: auto-retry every 5 seconds; screen auto-dismisses on connection.

---

## 4. Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the complete technical architecture.

### 4.1 Technology Stack

| Layer | Technology |
|---|---|
| **Native Shell** | Tauri v2 (Rust backend, WebKitGTK WebView) |
| **Backend Language** | Rust — async streaming, SQLite, keyring, systemd |
| **Frontend Framework** | Vue 3 (Composition API) + TypeScript |
| **Styling** | TailwindCSS v4 |
| **Markdown** | `markdown-it` + Shiki + KaTeX |
| **State Management** | Pinia |
| **Storage** | SQLite via `rusqlite` (WAL mode) |
| **Secrets** | `keyring` crate → Secret Service API |
| **Packaging** | PKGBUILD (AUR), `.deb`, AppImage (Tauri bundler) |

### 4.2 Data Model

```
conversations
├── id (UUID v4)
├── title
├── model
├── system_prompt           -- retained column; active prompt is a system message
├── settings_json           -- ChatOptions blob (temperature, top_p, num_ctx, etc.)
├── pinned (bool)
├── tags
├── draft_json              -- persistent chat input draft (nullable)
├── created_at, updated_at

messages
├── id (UUID v4)
├── conversation_id (FK → conversations)
├── role (user|assistant|system)
├── content
├── images_json, files_json
├── tokens_used, generation_time_ms
├── prompt_tokens, tokens_per_sec
├── total_duration_ms, load_duration_ms
├── prompt_eval_duration_ms, eval_duration_ms
├── created_at

settings
├── key (PK)
└── value (JSON-encoded)

hosts
├── id (UUID v4), name, url
├── is_default, is_active
├── last_ping_status (online|offline|unknown)
├── last_ping_at, created_at
-- NOTE: auth_token lives in system keyring, never in this table

model_cache
├── name (PK), host_id (FK → hosts)
├── size_bytes, family, parameters, quantization
├── capabilities_json, last_synced_at

folder_contexts
├── id (UUID v4)
├── conversation_id (FK → conversations)
├── path, included_files_json
├── auto_refresh, estimated_tokens
├── created_at
-- UNIQUE constraint on (conversation_id, path)
```

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target |
|---|---|
| Cold start to interactive | < 2 seconds |
| Input-to-first-token latency (local) | < 100ms app overhead |
| Streaming render FPS | 60 FPS sustained |
| Memory footprint (idle) | < 120 MB RSS |
| Memory footprint (active chat) | < 250 MB RSS |
| Binary size | < 15 MB |
| Chat history search | < 200ms for 10,000 messages |

### 5.2 Security

- API keys via `keyring` crate → Secret Service API — never plaintext on disk
- OAuth tokens via same system keyring
- Tauri scoped filesystem — frontend accesses only allowed paths
- No telemetry by default; all telemetry opt-in
- TLS 1.3 for cloud communications via `rustls`
- CSP headers enforced in WebView

### 5.3 Accessibility

- Full keyboard navigation
- ARIA attributes on interactive elements
- `rem` units for system font scaling
- `prefers-reduced-motion` respected

---

## 6. Linux Desktop Integration

| Integration | Implementation |
|---|---|
| **System tray** | `tray-icon` crate + `libappindicator` (KDE SNI, GNOME, Hyprland) |
| **Notifications** | `notify-rust` → D-Bus `org.freedesktop.Notifications` |
| **Global shortcuts** | Tauri v2 global shortcut plugin |
| **Dark/light mode** | `prefers-color-scheme` + manual toggle |
| **File dialogs** | Tauri dialog plugin → `xdg-desktop-portal` |
| **Secrets storage** | `keyring` crate → D-Bus Secret Service |
| **Wayland support** | WebKitGTK native Wayland; `xdg-decoration` |
| **Autostart** | Optional `.desktop` in `~/.config/autostart/` — disabled by default |
| **Ollama systemd service** | Explicit user action only: `systemctl start ollama` via Rust backend with polkit |

---

## 7. Packaging & Distribution

| Channel | Format | Status |
|---|---|---|
| **AUR (binary)** | PKGBUILD (`alpaka-desktop-bin`) | ✅ `packaging/aur/PKGBUILD` |
| **AUR (source)** | PKGBUILD (`alpaka-desktop-git`) | ✅ `packaging/aur-git/PKGBUILD` |
| **`.deb`** | Tauri bundler output | ✅ via `release.yml` CI |
| **AppImage** | Portable binary | ✅ via `release.yml` CI |
| **Flatpak** | `io.alpaka.desktop` | Backlog |
| **Source** | `cargo build` + `pnpm build` | ✅ documented in README |

### 7.1 Build Dependencies

```
Build-time:
  rust >= 1.77.2
  node >= 20 LTS (with pnpm >= 9)
  tauri-cli >= 2.0

Runtime (system packages):
  webkit2gtk-4.1
  gtk3
  libappindicator-gtk3
  libsoup3
  glib2
  libsecret
  xdg-desktop-portal

Optional:
  xdg-desktop-portal-kde
  xdg-desktop-portal-gtk
  keepassxc (alternative keyring backend)
```

---

## 8. Decision Log

| # | Decision | Rationale |
|---|---|---|
| D-01 | **Tauri v2** over Electron | ~15MB vs 200MB+ bundle; Rust backend; native WebKitGTK |
| D-02 | **Rust** backend | Memory-safe; Tauri native; tokio + reqwest for streaming |
| D-03 | **Vue 3 + TailwindCSS** | Lightweight Composition API; utility-first CSS; TypeScript support |
| D-04 | **SQLite** for persistence | Zero-config; WAL mode; `rusqlite` is Rust-native |
| D-05 | **Secret Service API** for secrets | DE-agnostic — works with KWallet, GNOME Keyring, KeePassXC |
| D-06 | **AUR-first** distribution | Target audience is Arch Linux; `.deb` and AppImage for broader reach |
| D-07 | **Clean modern UI** | Matches official Ollama Windows app; console aesthetic only in `<think>` blocks |
| D-08 | **No auto-start of Ollama service** | Explicit user action only; avoids unexpected resource usage |
| D-09 | **Guide + Retry for missing Ollama** | Never auto-install system software; friendly Connection Error screen |
| D-10 | **Multi-host, one active** | Named hosts with one active at a time; covers home server, cloud VPS |
| D-11 | **Lightweight folder context (no RAG)** | Plain text injection; no embedding model dependency |
| D-12 | **Full chat backup/restore** | JSON + SQLite backup covers casual and power users |
| D-13 | **Compact / TWM mode** | Dedicated narrow-width layout for Hyprland/Sway/i3 users |
| D-14 | **Services layer** (`services/`) | Commands are thin adapters; business logic is testable in isolation |
| D-15 | **IoC `core_*` functions** | Commands delegate to `core_*` functions accepting `DbConn` — enables unit tests without Tauri state |
| D-16 | **Polling-based auth** | `ollama signin` opens browser externally; frontend polls `get_auth_status` — avoids OAuth redirect handler complexity |

---

## 9. Milestones

| Phase | Scope | Status |
|---|---|---|
| **Phase 1 — MVP** | Chat, streaming, local model management, settings, system tray | ✅ Complete (v1.0.0) |
| **Phase 2 — Cloud** | OAuth signin (polling), cloud models, web search agent loop | ✅ Complete (v1.0.0) |
| **Phase 3 — Polish** | Hosts CRUD, multimodal input, drag-drop, SQLite backup/restore, keyboard shortcuts | ✅ Complete (v1.0.0–1.1.0) |
| **Phase 4 — Advanced** | Folder context (whole-folder ingest), hardware detection, library browser, thinking blocks | ✅ Complete (v1.0.0) |
| **Phase 5 — Distribution** | AUR (bin + git), `.deb`, AppImage, documentation site | ✅ v1.0.1 |
| **Phase 6 — v1.2** | Custom model creation, model tagging/favorites, preset profiles, per-model defaults, seed control, Mirostat, stop sequences, configurable model path, API key UI, conversation search | ✅ v1.2.0 |
| **Phase 7 — v1.3 (planned)** | Wire `ErrorScreen` into router, expose chat export button, folder-context tree picker, top-bar host switcher, true Compact/TWM layout (padding/font/top-bar collapse), Markdown export | Planned |
| **Phase 8 — v2.x** | Multi-chat tabs, chat branching, plugin system, Flatpak, proxy support, mobile companion | Planned |

### 9.1 Known UI Gaps (from v1.2.0 audit)

The following commands or components exist in the codebase but are **not currently
reachable from the UI**. They are tracked as P1 for v1.3:

| Item | What's missing | Where it lives |
|---|---|---|
| Per-conversation JSON export | No button calls `export_conversation` | `commands/chat.rs:257` |
| Folder-context tree picker | No component calls `list_folder_files` / `update_included_files` | `commands/folders.rs:265,310` |
| Token-estimate refresh | No component calls `estimate_tokens` | `commands/folders.rs:375` |
| Connection Error screen | `ErrorScreen.vue` is never imported | `components/shared/ErrorScreen.vue` |
| Standalone Hosts modal | `HostManager.vue` is never imported (Hosts are managed inside Settings instead) | `components/hosts/HostManager.vue` |
| Top-bar layout | `components/shared/TopBar.vue` is a 0-byte file | `components/shared/TopBar.vue` |
| Sidebar search box | `Sidebar.vue:43` `<input>` is bound to a local ref that never filters anything (real search is in `ConversationList`) | `components/sidebar/Sidebar.vue` |
| Systemd Ollama start/stop | Only caller is the unwired `ErrorScreen.vue` | `commands/service.rs` |
| True Compact / TWM mode | Only the icon strip is collapsed; padding / font / top-bar behaviour from §3.6 not implemented | `App.vue:14` |

---

## 10. Non-Goals (Explicit Exclusions)

- ❌ Mobile app
- ❌ Built-in model training or fine-tuning
- ❌ Multi-user / team collaboration
- ❌ Plugin/extension system (defer to v2)
- ❌ Windows or macOS support
- ❌ Bundling the Ollama server
- ❌ Auto-installing Ollama
- ❌ Running as a standalone web app
- ❌ Terminal-style main chat UI (console aesthetic restricted to `<think>` blocks)
- ❌ Full vector DB / embedding RAG
- ❌ Simultaneous multi-host connections

---

*Stack: Tauri v2 (Rust) + Vue 3 + TailwindCSS v4 · Feature parity baseline: Ollama Windows Desktop App (April 2026)*
