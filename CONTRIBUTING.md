# Contributing to Alpaka Desktop

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Writing Tests](#writing-tests)
- [Branching Model](#branching-model)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Code Style](#code-style)

---

## Development Setup

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust | stable (≥ 1.77.2) | [rustup.rs](https://rustup.rs) |
| Node.js | LTS (≥ 20) | [nodejs.org](https://nodejs.org) |
| pnpm | ≥ 9 | `npm i -g pnpm` |

**Linux system dependencies (Ubuntu/Debian):**

```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev
```

**Arch Linux:**

```bash
sudo pacman -S webkit2gtk-4.1 libappindicator-gtk3 librsvg
```

### Clone and install

```bash
git clone https://github.com/nikoteressi/alpaka-desktop.git
cd alpaka-desktop
pnpm install
```

### Start the dev app

```bash
pnpm tauri dev
```

This starts the Vite dev server with hot-reload and rebuilds the Rust backend on changes.

### Run checks individually

```bash
pnpm typecheck          # TypeScript type check
pnpm lint               # ESLint (auto-fix)
pnpm format             # Prettier
pnpm test               # Vitest unit tests
cargo test              # Rust integration tests (from src-tauri/)
```

---

## Project Structure

```
alpaka-desktop/
├── src/                  # Vue 3 frontend (TypeScript)
│   ├── stores/           # Pinia state (chat, models, hosts, settings)
│   ├── views/            # Page-level components
│   ├── composables/      # useStreaming, useAutoScroll, useKeyboard
│   └── lib/markdown.ts   # markdown-it + Shiki + KaTeX pipeline
├── src-tauri/            # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── commands/     # Tauri IPC handlers
│   │   ├── db/           # SQLite via rusqlite
│   │   ├── ollama/       # HTTP client + SSE streaming
│   │   └── auth/         # Keyring integration
│   └── tests/            # Integration tests
└── e2e/                  # Playwright end-to-end tests
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full detail on command signatures, the event catalog, and ADRs.

---

## Writing Tests

### Frontend (Vitest)

Unit tests live alongside source files or in `src/__tests__/`. Run with `pnpm test`.

```typescript
// Example: testing a Pinia store action
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '@/stores/chat'

describe('chat store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('clears messages on reset', () => {
    const store = useChatStore()
    store.reset()
    expect(store.messages).toHaveLength(0)
  })
})
```

### Backend (cargo test)

Integration tests live in `src-tauri/tests/`. Each test gets an in-memory SQLite database — no external services required.

```bash
cd src-tauri
cargo test                    # all tests
cargo test chat               # tests matching "chat"
cargo test -- --nocapture     # show println! output
```

### End-to-end (Playwright)

E2E tests live in `e2e/`. They require the app to be running (`pnpm tauri dev`).

```bash
pnpm exec playwright test
```

---

## Branching Model

This project uses **GitFlow**. Always branch from the correct base.

```
main          ← always matches the latest stable release tag
develop       ← integration branch for the next release
feature/xxx   ← new features  (branch from develop)
bugfix/xxx    ← non-critical bug fixes  (branch from develop)
hotfix/xxx    ← critical production fixes  (branch from main)
release/x.y.z ← release stabilisation  (branch from develop)
```

### New feature or non-critical bugfix

```bash
git checkout develop
git checkout -b feature/my-feature   # or bugfix/my-fix
# ... work ...
# open PR → develop
```

### Critical hotfix (bug in a released version)

```bash
git checkout main
git checkout -b hotfix/crash-fix
# ... fix ...
# open PR → main  (gets tagged as PATCH release)
# then back-merge main → develop so the fix is not lost
```

### Release cycle

1. Cut `release/x.y.z` from `develop`
2. Only bugfixes go into the release branch — no new features
3. Merge to `main`, tag `vX.Y.Z`, build & publish
4. Back-merge `release/x.y.z` → `develop`

### Versioning (`MAJOR.MINOR.PATCH`)

| Change | Version bump |
|--------|-------------|
| Hotfix | `PATCH` — 1.0.0 → 1.0.1 |
| New feature | `MINOR` — 1.0.x → 1.1.0 |
| Breaking change | `MAJOR` — 1.x.x → 2.0.0 |

---

## Submitting a Pull Request

1. **Create a branch from the correct base** (see Branching Model above):
   ```bash
   git checkout develop
   git checkout -b feature/my-feature
   ```

2. **Make your changes.** Keep commits focused — one logical change per commit.

3. **Ensure all checks pass locally** before pushing:
   ```bash
   pnpm typecheck && pnpm test && cd src-tauri && cargo test
   ```

4. **Open a PR** against `develop` (or `main` for hotfixes). Fill in the PR template:
   - What does this change do?
   - How to test it?
   - Screenshots for UI changes.

5. A maintainer will review and merge once CI passes.

### PR guidelines

- Keep PRs small and focused. Large refactors are harder to review.
- Add tests for new behaviour.
- Update `docs/ARCHITECTURE.md` if you change command signatures, events, or the DB schema.
- Update `CHANGELOG.md` under `[Unreleased]` for every user-visible change.
- Do not bump version numbers in PRs — releases are managed by maintainers.

---

## Code Style

- **Rust:** `cargo fmt` (enforced by CI) + `cargo clippy` warnings-as-errors.
- **TypeScript/Vue:** Prettier + ESLint. Run `pnpm lint && pnpm format`.
- **Comments:** Only where the *why* is non-obvious. No block comments narrating what the code does.
- **No `any` in TypeScript** — use specific interfaces or `unknown`.

---

Questions? Open a [Discussion](https://github.com/nikoteressi/alpaka-desktop/discussions) or drop into the issues tracker.
