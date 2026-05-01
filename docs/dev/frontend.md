# Frontend Reference

The Vue 3 frontend lives in `src/`. It uses the Composition API exclusively and communicates with the Rust backend via `@tauri-apps/api/core` `invoke()` calls and `@tauri-apps/api/event` listeners.

## Pinia Stores (`src/stores/`)

| Store | File | Manages |
|---|---|---|
| `chat` | `chat.ts` | Conversations, messages, streaming state, draft |
| `models` | `models.ts` | Local models, pull progress, model user data |
| `hosts` | `hosts.ts` | Host list, health status, active host |
| `settings` | `settings.ts` | KV settings, generation defaults |
| `auth` | `auth.ts` | Authentication state, sign-in flow |

## Key Composables (`src/composables/`)

| Composable | Purpose |
|---|---|
| `useStreaming.ts` | Accumulates streaming tokens into reactive state |
| `useStreamingEvents.ts` | Registers Tauri event listeners for all `chat:*` events |
| `useSendMessage.ts` | Orchestrates message send flow (validate, invoke, stream) |
| `useConversationLifecycle.ts` | New conversation creation, switching, deletion |
| `useAppOrchestration.ts` | Top-level app startup and teardown |
| `useDraftManager.ts` | Per-conversation draft persistence (settings, input text) |
| `useContextWindow.ts` | Folder context attach/detach, token counting |
| `useAttachments.ts` | Image/file attachment handling |
| `useAutoScroll.ts` | Chat auto-scroll with manual override detection |
| `useKeyboard.ts` | Global keyboard shortcut registration |
| `useTheme.ts` | Dark/light mode toggle and persistence |
| `useModelLibrary.ts` | Ollama library search and tag fetching |

## Tauri Event Catalog

All events emitted from the Rust backend and listened to in the frontend:

| Event | Payload | Listener |
|---|---|---|
| `chat:token` | `{ conversation_id, content }` | `useStreamingEvents.ts` |
| `chat:thinking-start` | `{ conversation_id }` | `useStreamingEvents.ts` |
| `chat:thinking-token` | `{ conversation_id, content }` | `useStreamingEvents.ts` |
| `chat:thinking-end` | `{ conversation_id }` | `useStreamingEvents.ts` |
| `chat:done` | `{ conversation_id, tokens_per_sec? }` | `useStreamingEvents.ts` |
| `chat:error` | `{ conversation_id, error }` | `useStreamingEvents.ts` |
| `chat:tool-call` | `{ conversation_id, tool_name, arguments }` | `useStreamingEvents.ts` |
| `chat:tool-result` | `{ conversation_id, tool_name, result }` | `useStreamingEvents.ts` |
| `model:pull-progress` | `{ model, status, percent? }` | `stores/models.ts` |
| `model:pull-done` | `{ model }` | `stores/models.ts` |
| `host:status-change` | `{ host_id, status, latency_ms? }` | `stores/hosts.ts` |

## Markdown Pipeline (`src/lib/markdown.ts`)

Messages are rendered through: **markdown-it** (CommonMark + GFM) → **Shiki** (syntax highlighting, async, preloaded after mount) → **KaTeX** (LaTeX math via `$...$` and `$$...$$`).

Shiki is preloaded asynchronously after first mount to avoid blocking first render.
