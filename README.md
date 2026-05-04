<!-- markdownlint-disable MD033 MD041 -->

<p align="center">
  <img src="public/logo.png" alt="Alpaka Desktop Logo" width="128">
</p>

<h1 align="center">Alpaka Desktop</h1>

<p align="center">
  <b>A native, first-class Ollama desktop client for Linux.</b><br/>
  Built with Tauri v2 and Vue 3, designed for KDE Plasma and Wayland.
</p>

<!-- markdownlint-disable MD013 -->
<p align="center">
  <a href="https://github.com/nikoteressi/alpaka-desktop/releases/latest"><img src="https://img.shields.io/github/v/release/nikoteressi/alpaka-desktop?label=release&style=flat-square" alt="Latest Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="MIT License"></a>
  <a href="https://github.com/nikoteressi/alpaka-desktop/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/nikoteressi/alpaka-desktop/release.yml?label=CI&style=flat-square" alt="CI Status"></a>
  <img src="https://img.shields.io/badge/platform-Linux-orange?style=flat-square" alt="Platform: Linux">
</p>
<!-- markdownlint-enable MD013 -->

<br/>

Alpaka Desktop is a local-first AI interface that brings the power of
[Ollama](https://ollama.com) to your desktop with a native experience. It
focuses on performance, privacy, and deep integration with the Linux desktop
environment.

---

## ✨ Features

- **⚡ Real-time Streaming** — Token-by-token rendering with live Markdown,
  Shiki syntax highlighting, and KaTeX math.
- **🧠 Thinking Blocks** — Collapsible `<think>` panels for models that expose
  chain-of-thought reasoning (e.g., DeepSeek R1, GPT-OSS).
- **🗜️ Smart Context Management** — Automatic sliding-window truncation on every
  send, plus a one-click **Compact** action that summarises the conversation
  and continues in a new chat with the summary as the system prompt.
- **🖥️ Multi-host Management** — Manage multiple Ollama endpoints (local, LAN,
  Cloud) with background health pings every 30 seconds. Switch between hosts
  from `Settings → Connection`.
- **🔒 Secure Keyring** — API keys, OAuth tokens, and per-host bearer tokens
  stored in the system Secret Service (KWallet, GNOME Keyring, KeePassXC) —
  never in the database, never on disk.
- **📦 Model Manager** — Pull (with progress), delete, star, tag, and create
  custom models from Modelfiles. Configurable model storage path with a
  systemd override.
- **🎛️ Three-layer Settings** — Global defaults → Per-model overrides →
  Per-chat adjustments. Mirostat 1/2, fixed seed, stop sequences, presets
  (Creative / Balanced / Precise / Code) and user-defined profiles.
- **🌐 Web Search** — Built-in agentic tool-call loop (up to 5 iterations) via
  the Ollama Web Search API, with collapsible result cards.
- **📁 Folder Context** — Drop a folder or text file onto the chat input and
  it's ingested as a system message. (Per-file selection from a tree picker is
  planned for v1.3 — today the whole folder is ingested, capped at 50 MB /
  1000 files.)
- **🖼️ Multimodal Input** — Attach images via the menu or drag-drop; up to 10
  images × 20 MB. Vision-model support follows the Ollama capability flag.
  (`Ctrl+V` paste was removed in v1.2.0 — it was broken on
  WebKitGTK/Wayland.)
- **⌨️ Keyboard-first** — `Ctrl+N` new chat, `Ctrl+K` search conversations,
  `Ctrl+M` model switcher, `Ctrl+,` settings, `Ctrl+H` connection settings,
  `Escape` stop generation, plus full undo/redo in the input.
- **💾 Backup & Restore** — Native SQLite online backup from
  `Settings → Maintenance`.
- **🐧 Native Linux UX** — System tray (Show / Hide / Quit), desktop
  notifications via D-Bus, smart-focus suppression, and first-class Wayland
  support.

---

## 📺 See It In Action

| Streaming Chat | Thinking Blocks |
| :--- | :--- |
| ![Streaming chat](docs/demo/streaming.gif) | ![Thinking blocks](docs/demo/thinking.gif) |

---

## 🚀 Quick Start

### 📦 Installation

#### **AppImage (Universal)**

Download the latest `.AppImage` from
[Releases](https://github.com/nikoteressi/alpaka-desktop/releases/latest),
then:

```bash
chmod +x alpaka-desktop_*.AppImage
./alpaka-desktop_*.AppImage --appimage-integrate
```

#### **Debian / Ubuntu (APT)**

```bash
# 1. Import signing key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://nikoteressi.github.io/alpaka-desktop/apt/key.gpg | \
  sudo tee /etc/apt/keyrings/alpaka-desktop.asc > /dev/null

# 2. Add repository
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/alpaka-desktop.asc] \
  https://nikoteressi.github.io/alpaka-desktop/apt stable main" | \
  sudo tee /etc/apt/sources.list.d/alpaka-desktop.list

# 3. Install
sudo apt update && sudo apt install alpaka-desktop
```

#### **Arch Linux (AUR)**

```bash
yay -S alpaka-desktop-bin
```

---

## 🛠️ Build from Source

### Prerequisites

- **Rust** (stable ≥ 1.77.2)
- **Node.js** (≥ 20) + **pnpm**
- **Linux system dependencies**: `libwebkit2gtk-4.1-dev`,
  `libappindicator3-dev`, `librsvg2-dev`

### Steps

```bash
git clone https://github.com/nikoteressi/alpaka-desktop.git
cd alpaka-desktop
pnpm install
pnpm tauri build
```

Build artifacts can be found in `src-tauri/target/release/bundle/`.

---

## 📋 Requirements

- **Linux** (x86_64)
- **Ollama** running locally or on a reachable host.
- **Secret Service provider** for keyring (KWallet, GNOME Keyring, or
  KeepassXC).

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for
details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.
