# Alpaka Desktop — Linux Native Client

> **Product Specification v1.0.0** — 2026-04-27
> Target: Linux (primary: Arch Linux · KDE Plasma 6 · Wayland)
> Companion to [ARCHITECTURE.md](ARCHITECTURE.md)

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
| C-02 | **Streaming text rendering** | P0 | ✅ | Token-by-token display with typing cursor animation |
| C-03 | **Reasoning/thinking blocks** | P0 | ✅ | Collapsible `<think>` panels with console-style rendering and pulsing border |
| C-04 | **Markdown rendering** | P0 | ✅ | Full GFM: tables, code fences, math (KaTeX) |
| C-05 | **Code blocks with copy button** | P0 | ✅ | Language detection, syntax highlighting (Shiki), one-click copy |
| C-06 | **Chat history persistence** | P0 | ✅ | SQLite-backed; search, rename, pin, delete conversations |
| C-07 | **Multi-chat tabs/panels** | P1 | Backlog | Side-by-side or tabbed conversations |
| C-08 | **Chat export** | P1 | ✅ | Export to Markdown / JSON |
| C-09 | **Chat branching** | P2 | Backlog | Fork conversation at any message |
| C-10 | **Chat backup & restore** | P1 | ✅ | Full JSON export/import; raw SQLite backup/restore |
| C-11 | **Compact / TWM mode** | P1 | ✅ | Hides sidebar, reduces padding; for tiling WM users |

### 2.2 Multimodal Input

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| M-01 | **Image input** | P0 | ✅ | Paste, drag-drop, file-pick for vision models |
| M-02 | **File drag-and-drop** | P0 | ✅ | Drop PDFs, text, code files for summarization |
| M-03 | **Document preview** | P1 | ✅ | Thumbnail/preview of attached files before sending |
| M-04 | **Clipboard image paste** | P0 | ✅ | Ctrl+V image directly from clipboard |
| M-05 | **Audio input** | P2 | Backlog | Whisper-based speech-to-text |

### 2.3 Model Management

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| MO-01 | **Browse local models** | P0 | ✅ | List with size, family, quantization, parameter count |
| MO-02 | **Search Ollama library** | P0 | ✅ | Search `ollama.com/library` from within the app |
| MO-03 | **Download/pull models** | P0 | ✅ | Progress bar, streamed progress events |
| MO-04 | **Delete models** | P0 | ✅ | Individual deletion with size indicator |
| MO-05 | **Model details view** | P0 | ✅ | Capabilities, README, tags via library API |
| MO-06 | **Custom model creation** | P1 | Backlog | Create from Modelfile |
| MO-07 | **Model tags/favorites** | P1 | ✅ | User tags and quick-access favorites |
| MO-08 | **Configurable storage path** | P0 | Backlog | Choose where model blobs are stored |
| MO-09 | **Model update notifications** | P1 | Backlog | Detect newer versions of pulled models |

### 2.4 Ollama Cloud Integration

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| CL-01 | **User authentication** | P0 | ✅ | Sign in via `ollama signin` OAuth flow (polling-based) |
| CL-02 | **Cloud model access** | P0 | ✅ | Run models hosted on Ollama Cloud |
| CL-03 | **API key management** | P0 | Partial | Store/retrieve via keyring; UI management backlog |
| CL-04 | **Private model sync** | P1 | Backlog | Push/pull private models |
| CL-05 | **Usage dashboard** | P1 | Backlog | Cloud compute usage, cost tracking |
| CL-06 | **Web search integration** | P0 | ✅ | Agentic tool-call loop via Ollama Web Search API |

### 2.5 Context & Generation Settings

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| S-01 | **Temperature slider** | P0 | ✅ | Range 0.0–2.0 |
| S-02 | **Context length slider** | P0 | ✅ | Adjustable num_ctx |
| S-03 | **System prompt editor** | P0 | ✅ | Per-conversation; stored as system role message |
| S-04 | **Top-P / Top-K** | P0 | ✅ | Fine-grained sampling control |
| S-05 | **Repeat penalty** | P0 | ✅ | repeat_penalty, repeat_last_n |
| S-06 | **Stop sequences** | P1 | Backlog | Custom stop tokens |
| S-07 | **Seed control** | P1 | Backlog | Fixed seed for reproducible outputs |
| S-08 | **Mirostat** | P1 | Backlog | Mirostat 1/2 with tau and eta |
| S-09 | **Preset profiles** | P1 | Backlog | Save/load parameter presets |
| S-10 | **Per-model defaults** | P1 | Backlog | Different default settings per model |

### 2.6 GPU & Performance

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| G-01 | **GPU status display** | P0 | ✅ | `detect_hardware` reads /proc/meminfo + DRM sysfs for GPU/VRAM |
| G-02 | **Multi-GPU support** | P0 | ✅ | Via Ollama's multi-GPU scheduling |
| G-03 | **CPU fallback indicator** | P0 | ✅ | Visual indicator when running on CPU vs GPU |
| G-04 | **Performance metrics** | P1 | ✅ | Tokens/sec, TTFT, total duration stored per-message |
| G-05 | **GPU layer configuration** | P1 | Backlog | num_gpu layers for partial offloading |

### 2.7 Networking, Hosts & Sharing

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| N-01 | **LAN mode** | P0 | ✅ | Multiple Ollama endpoints including LAN servers |
| N-02 | **Hosts Manager** | P0 | ✅ | Add/edit/remove hosts with name, URL, optional auth |
| N-03 | **Quick host switching** | P0 | ✅ | Dropdown in top bar; model list refreshes on switch |
| N-04 | **Host health indicator** | P1 | ✅ | Background ping every 30s; `host:status-change` event |
| N-05 | **Proxy support** | P1 | Backlog | HTTP/SOCKS5 proxy |

### 2.8 Coding Tools Integration

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| CT-01 | **`ollama launch` support** | P1 | Backlog | Quick-launch coding tools |
| CT-02 | **Anthropic Messages API compat** | P1 | Backlog | Local models with Claude Code–compatible tools |
| CT-03 | **Tool calling visualization** | P1 | ✅ | `chat:tool-call` / `chat:tool-result` events render inline |

### 2.9 Local Folder Context (Lightweight RAG)

| ID | Feature | Priority | Status | Notes |
|---|---|---|---|---|
| LFC-01 | **Link local directories** | P1 | ✅ | Attach folders to conversations |
| LFC-02 | **File parsing** | P1 | ✅ | `.txt`, `.md`, `.py`, `.rs`, `.js`, `.ts`, `.json`, `.yaml`, `.toml`, etc. |
| LFC-03 | **Selective file inclusion** | P1 | ✅ | Tree-view picker per linked folder |
| LFC-04 | **Context size indicator** | P1 | ✅ | Estimated token count vs model `num_ctx` limit |
| LFC-05 | **Auto-refresh** | P2 | Backlog | Watch for file changes |

> **Design note:** No vector DB, no embedding model. Files are read, parsed to text, and prepended to the conversation context as a system message.

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

| Shortcut | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | New line in input |
| `Ctrl+N` | New conversation |
| `Ctrl+K` | Quick model switcher |
| `Ctrl+,` | Open settings |
| `Ctrl+Shift+C` | Copy last response |
| `Ctrl+/` | Toggle sidebar |
| `Escape` | Stop generation |
| `Ctrl+↑/↓` | Navigate chat history |
| `Ctrl+Shift+M` | Toggle Compact / TWM Mode |
| `Ctrl+H` | Open Hosts Manager |

### 3.6 Compact / TWM Mode

For tiling WM users (Hyprland, Sway, i3):

| Behavior | Standard | Compact |
|---|---|---|
| **Sidebar** | Visible (260px) | Hidden; overlay via `Ctrl+/` |
| **Message padding** | 16px / 12px | 8px / 6px |
| **Top bar** | Full controls | Model name + host dot only |
| **Font sizes** | 15px / 14px | 13px / 12px |
| **Min useful width** | ~500px | ~320px |

### 3.7 Connection Error Screen

Displayed when the active Ollama host is unreachable:

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

Auto-retry every 5 seconds; screen auto-dismisses on connection.

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
| **Phase 1 — MVP** | Chat, streaming, local model management, settings, Connection Error screen, Compact/TWM mode, system tray | ✅ Complete |
| **Phase 2 — Cloud** | Authentication (polling flow), cloud models, web search tool calls, API key management | ✅ Complete |
| **Phase 3 — Polish** | Hosts Manager, multimodal input, file drag-drop, chat backup/restore, keyboard shortcuts | ✅ Complete |
| **Phase 4 — Advanced** | Folder context, chat export, hardware detection, library browser, thinking blocks | ✅ Complete |
| **Phase 5 — Distribution** | AUR (bin + git), `.deb`, AppImage, documentation, CONTRIBUTING guide | ✅ v1.0.0 |
| **Phase 6 — v1.x** | Custom model creation, model tagging, preset profiles, Flatpak, plugin system | Planned |

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
