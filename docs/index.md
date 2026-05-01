---
layout: home

hero:
  name: "Alpaka Desktop"
  text: "A first-class Ollama desktop client for Linux"
  tagline: "Real-time streaming, thinking blocks, multi-host, and the full Ollama feature set — in a native Tauri app built for KDE Plasma and Wayland."
  image:
    src: /alpaka-desktop.png
    alt: Alpaka Desktop chat interface
  actions:
    - theme: brand
      text: Download AppImage
      link: https://github.com/nikoteressi/alpaka-desktop/releases/latest
    - theme: alt
      text: Read the Docs
      link: /alpaka-desktop/guide/
    - theme: alt
      text: View on GitHub
      link: https://github.com/nikoteressi/alpaka-desktop

features:
  - icon: ⚡
    title: Real-time streaming
    details: Token-by-token rendering with live Markdown, Shiki syntax highlighting, and KaTeX math rendering.
  - icon: 🧠
    title: Thinking blocks
    details: Collapsible <think> panels for models that expose chain-of-thought reasoning, with a pulsing border while active.
  - icon: 🖥️
    title: Multi-host management
    details: Add multiple Ollama endpoints, monitor health status and latency, and switch between them instantly.
  - icon: 🔒
    title: Secure keyring
    details: API keys and OAuth tokens stored in the system Secret Service (KWallet / GNOME Keyring) — never in SQLite.
  - icon: 📦
    title: Model manager
    details: Pull, tag, favorite, and create custom models from Modelfiles. Configure per-model storage paths.
  - icon: 🎛️
    title: Three-layer settings
    details: Global defaults → per-model defaults → per-chat options. Each layer overrides the one below it.
  - icon: 🌐
    title: Web search
    details: Built-in agentic tool-call loop via the Ollama Web Search API, with collapsible result cards.
  - icon: 🐧
    title: Native Linux
    details: System tray, desktop notifications, systemd service control, KDE Plasma / Wayland first-class support.
---

## See It In Action

<div class="demo-grid">

![Streaming chat](./demo/streaming.gif)
*Real-time token streaming with live Markdown*

![Model manager](./demo/models.png)
*Browse, pull, and manage local models*

![Thinking blocks](./demo/thinking.gif)
*Collapsible chain-of-thought reasoning panels*

</div>

::: tip Recording demo assets
Commit GIFs and screenshots to `docs/demo/` before publishing the site:
- `docs/demo/streaming.gif` — record a streaming chat response (~10s)
- `docs/demo/models.png` — screenshot of the Models → Local tab
- `docs/demo/thinking.gif` — record a thinking block expanding/collapsing (~8s)

Tools: [Peek](https://github.com/phw/peek) or [Byzanz](https://github.com/GNOME/byzanz) for GIF recording. Keep each GIF under 5 MB.
:::

## Install

::: code-group

```bash [AppImage]
# Download from GitHub Releases, then:
chmod +x alpaka-desktop_*.AppImage
./alpaka-desktop_*.AppImage

# Optional: integrate with your desktop launcher
./alpaka-desktop_*.AppImage --appimage-integrate
```

```bash [APT / Debian]
# Import signing key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://nikoteressi.github.io/alpaka-desktop/apt/key.gpg \
  | sudo tee /etc/apt/keyrings/alpaka-desktop.asc > /dev/null

# Add repository
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/alpaka-desktop.asc] \
  https://nikoteressi.github.io/alpaka-desktop/apt stable main" \
  | sudo tee /etc/apt/sources.list.d/alpaka-desktop.list

sudo apt update && sudo apt install alpaka-desktop
```

```bash [AUR]
yay -S alpaka-desktop-bin   # pre-built AppImage
# or
yay -S alpaka-desktop-git   # build from source
```

```bash [Build from source]
git clone https://github.com/nikoteressi/alpaka-desktop.git
cd alpaka-desktop
pnpm install
pnpm tauri build
# Output: src-tauri/target/release/bundle/
```

:::

## Requirements

- Linux x86_64
- [Ollama](https://ollama.com/download/linux) running locally or on a reachable host
- A Secret Service provider (KWallet, GNOME Keyring, or KeePassXC with D-Bus bridge)
