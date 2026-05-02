# Chat

## Sending Messages

Type in the input box and press **Enter** to send. Use **Shift+Enter** for a newline. Press **Escape** to stop generation mid-stream.

## Streaming

Tokens render as they arrive. Markdown, code blocks, tables, and math (LaTeX via KaTeX) are rendered live. A blinking cursor indicates active generation.

## Thinking Blocks

Models that expose chain-of-thought reasoning (e.g. DeepSeek-R1) wrap their internal reasoning in `<think>` tags. Alpaka Desktop detects these automatically and renders them in a collapsible panel with a pulsing border while the model is still thinking.

- Click the panel header to collapse or expand at any time — including while the model is still thinking.
- The final response appears below the thinking block.

## Attachments

Attach files to your message using the paperclip button or by dragging and dropping onto the input area.

| Type | How to attach | Notes |
|---|---|---|
| Images | Drag-drop or file picker | Vision models only (e.g. LLaVA, Gemma 3) |
| Text files | Drag-drop or file picker | Content is included in the prompt |
| PDFs | Drag-drop or file picker | Text is extracted and included |

A thumbnail preview appears in the input area before sending. Click the × to remove an attachment.

## Web Search

When web search is enabled (toggle in the Advanced Options panel), Alpaka Desktop uses Ollama's built-in Web Search tool call. The model can request searches during generation; results appear as collapsible cards in the chat.

## Chat History

All conversations are saved automatically to a local SQLite database.

| Action | How |
|---|---|
| Search conversations | `Ctrl+K` or the search icon in the sidebar |
| Rename | Right-click a conversation in the sidebar |
| Pin | Right-click → Pin to keep at the top |
| Delete | Right-click → Delete |

## Compact / TWM Mode

For tiling window manager users (Hyprland, Sway, i3), Compact Mode reduces padding and hides the sidebar to make the app usable at narrow widths (min ~320px). Toggle with `Ctrl+Shift+M`.

See [Keyboard Shortcuts](/guide/keyboard) for all shortcuts.
