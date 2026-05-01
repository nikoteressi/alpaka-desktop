# Architecture Overview

Alpaka Desktop is a Tauri v2 desktop application: a single process with a Rust backend and a Vue 3 SPA frontend rendered in WebKitGTK. Frontend and backend communicate exclusively via Tauri IPC.

## High-Level Structure

```
┌──────────────────────────────────────────────────────────────┐
│                      TAURI v2 PROCESS                        │
│  ┌────────────────────────┐    ┌───────────────────────────┐ │
│  │   Vue 3 Frontend       │    │   Rust Backend            │ │
│  │   (WebKitGTK WebView)  │◄──►│   (Tauri Commands)        │ │
│  │                        │IPC │                           │ │
│  │  Pinia Stores          │    │  commands/    (IPC layer)  │ │
│  │  Composables           │    │  services/    (logic)      │ │
│  │  Views                 │    │  ollama/      (HTTP)       │ │
│  └────────────────────────┘    │  db/          (SQLite)    │ │
│                                │  auth/        (keyring)   │ │
│                                │  system/      (tray etc.) │ │
│                                └───────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
  Static Assets (Vite)         Ollama Hosts (HTTP)
```

## Communication Patterns

| Direction | Mechanism | Used for |
|---|---|---|
| Frontend → Backend | `invoke('command_name', payload)` | Request/response (CRUD, settings, model ops) |
| Backend → Frontend | `app.emit('event:name', payload)` / `listen()` | Streaming tokens, async progress, health updates |

## Backend Layering

```
commands/       ← Tauri IPC boundary (thin adapters only — no business logic)
    └── services/   ← Business logic (ChatService, PromptService, WebSearchService, LibraryService)
            └── ollama/client.rs   ← HTTP client with multi-host routing
            └── db/                ← SQLite via rusqlite
            └── auth/keyring.rs    ← Secret Service API
```

## Frontend Layering

```
views/          ← Page-level Vue components (ChatPage, ModelsPage, SettingsPage, LaunchPage)
    └── composables/    ← Reactive logic units (23 composables)
            └── stores/ ← Pinia state (chat, models, hosts, settings, auth)
```

## Key Design Decisions

**Why Tauri v2, not Electron?** Binary size and memory. The Tauri binary is ~8 MB and uses ~60 MB PSS at idle. An Electron equivalent is typically 150–200 MB binary and 300+ MB at idle.

**Why SQLite, not a remote database?** Alpaka Desktop is local-first. All conversation history stays on your machine. The SQLite file lives in the Tauri app data directory (`~/.local/share/alpaka-desktop/`).

**Why Secret Service for API keys?** Keys stored in SQLite would be readable by any process with access to the file. The Secret Service API provides OS-level access control, the same mechanism used by browsers and password managers.

## Full Reference

The complete internal architecture document (command registry, SQLite schema, ADRs, performance budget) is at [`docs/ARCHITECTURE.md`](https://github.com/nikoteressi/alpaka-desktop/blob/main/docs/ARCHITECTURE.md) in the repository.
