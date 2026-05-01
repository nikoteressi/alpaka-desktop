# Multi-Host Management

Alpaka Desktop can connect to multiple Ollama instances simultaneously — useful for running different models on different machines, or routing between a local instance and Ollama Cloud.

## Adding a Host

1. Go to **Settings → Hosts** (or press `Ctrl+H`).
2. Click **Add host**.
3. Enter the host URL (e.g. `http://192.168.1.10:11434` for a LAN server, or `https://api.ollama.com` for Ollama Cloud).
4. Click **Save**. Alpaka Desktop immediately pings the host.

## Health Monitoring

Each host shows a status indicator:
- 🟢 **Green** — reachable, latency shown in ms
- 🔴 **Red** — unreachable
- ⚪ **Grey** — not yet pinged

The health loop pings all hosts in the background. Status updates appear in the top bar as soon as a ping completes.

## Switching Hosts

Click the host indicator in the top bar to open a quick-switcher. Selecting a different host reloads the model list for that host. Your conversation history is stored locally and is available regardless of which host is active.

## Ollama Cloud as a Host

Adding `https://api.ollama.com` as a host enables Ollama Cloud models. The API key stored in **Settings → Account → API Keys** is injected automatically on all requests to this host.
