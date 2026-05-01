# Contributing

Contributions are welcome. This guide covers everything you need from setup to merged PR.

## Development Setup

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | stable (≥ 1.88.0) | [rustup.rs](https://rustup.rs) |
| Node.js | LTS (≥ 20) | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 9 | `npm i -g pnpm` |

**Linux system dependencies (Ubuntu/Debian):**
```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev patchelf libssl-dev \
  libgtk-3-dev libayatana-appindicator3-dev
```

**Arch Linux:**
```bash
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg
```

### Clone and run

```bash
git clone https://github.com/nikoteressi/alpaka-desktop.git
cd alpaka-desktop
pnpm install
pnpm tauri dev   # hot-reload frontend + Rust rebuild on save
```

## Branching Model

| Task | Branch prefix | Base branch |
|---|---|---|
| New feature | `feature/<name>` | `develop` |
| Non-critical bug | `bugfix/<name>` | `develop` |
| Critical hotfix | `hotfix/<name>` | `main` |

PRs target `develop` (features/bugfixes) or `main` (hotfixes). Hotfix merges to `main` must also back-merge into `develop`.

## Before You Push

```bash
pnpm format && pnpm test          # frontend: format + Vitest
cd src-tauri && cargo fmt         # Rust formatter
cd src-tauri && cargo test        # Rust integration tests
```

Both must pass. CI enforces the same checks.

## Pull Request Checklist

- [ ] Created a GitHub issue first (`gh issue create`)
- [ ] Branch name matches the prefix for the task type
- [ ] PR description includes `Closes #<issue-number>`
- [ ] `CHANGELOG.md` updated under `[Unreleased]` for any user-visible change
- [ ] `pnpm format && pnpm test` passes locally
- [ ] `cargo fmt && cargo test` passes locally

## Code Style

- **Vue:** Composition API only (`<script setup>`). No Options API.
- **Comments:** Only when the WHY is non-obvious. Never describe what code does.
- **TypeScript:** strict mode, no `any`. Prefer narrowing over casting.
- **Rust:** `clippy -D warnings` must pass. No `unwrap()` in production paths — use `?` and `AppError`.
- **TailwindCSS v4** — CSS-based config in `src/style.css`. No `tailwind.config.js`.

## Creating a GitHub Issue

```bash
gh issue create \
  --title "feat: <short description>" \
  --label "type: feature" \
  --milestone "v1.x.0"
```

Labels: `type: feature`, `type: bug`, `type: docs`, `type: ci`, `type: security`.
