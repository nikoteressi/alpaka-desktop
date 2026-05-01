# Getting Started

Alpaka Desktop is a native Linux desktop client for [Ollama](https://ollama.com). It connects directly to your local (or remote) Ollama instance and provides a full chat UI with streaming, model management, and advanced generation controls.

## Prerequisites

Before launching Alpaka Desktop you need Ollama running:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start the service
ollama serve

# Pull your first model
ollama pull llama3.2
```

Ollama listens on `http://localhost:11434` by default. Alpaka Desktop connects there automatically on first launch.

## Installation

See the [landing page](/) for all installation options (AppImage, APT, AUR, source build).

## First Launch

1. **Open Alpaka Desktop.** The app icon appears in your system tray.
2. **Check the host connection.** A green dot next to the host name in the top bar means Ollama is reachable. If you see a red dot, go to **Settings → Hosts** and verify the URL (`http://localhost:11434`).
3. **Select a model.** Click the model selector in the top bar and choose a model you have pulled. If the list is empty, go to **Models → Library** to pull one.
4. **Start chatting.** Type a message and press **Enter** to send. Tokens stream in real time.

## Interface Overview

```
┌──────────────────────────────────────────────────────┐
│ [≡] Alpaka Desktop  [llama3.2 ▾] [● localhost]  [⚙] │  ← top bar
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  Sidebar   │           Chat area                     │
│            │                                         │
│  ▸ New     │   User message                          │
│  ─────     │   ─────────────────────────────────     │
│  Today     │   Assistant response (streaming)        │
│    Conv 1  │                                         │
│    Conv 2  │                                         │
│  Yesterday │                                         │
│    Conv 3  │                                         │
│            ├─────────────────────────────────────────┤
│            │  [📎] Type a message...        [Send ▶] │  ← input
└────────────┴─────────────────────────────────────────┘
```

- **Sidebar** — conversation history, organized by date. Click a conversation to open it. Use `Ctrl+/` to toggle.
- **Top bar** — model selector, host indicator, and settings button.
- **Chat area** — messages render Markdown, code blocks, math (LaTeX), and thinking blocks.
- **Input** — `Enter` sends, `Shift+Enter` inserts a newline.

## What's Next

- [Chat features](/guide/chat) — streaming, thinking blocks, attachments, export
- [Model management](/guide/models) — pull, tag, create custom models
- [Settings](/guide/settings) — understand the three-layer settings system
