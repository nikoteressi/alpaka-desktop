# Settings & Generation Options

Alpaka Desktop has three layers of settings that apply to every conversation. The highest-priority layer always wins.

## How Settings Interact

```
┌─────────────────────────────────────────────────────────────────┐
│  Per-Chat Options                          HIGHEST PRIORITY     │
│  Chat → Advanced Options panel · applies to this conversation   │
├─────────────────────────────────────────────────────────────────┤
│  Per-Model Defaults                        MEDIUM PRIORITY      │
│  Models → click model → Edit Defaults · applies when selected   │
├─────────────────────────────────────────────────────────────────┤
│  Global Defaults                           LOWEST PRIORITY      │
│  Settings → Advanced tab · applies to all new conversations     │
└─────────────────────────────────────────────────────────────────┘
```

**Rules:**
- Per-model defaults only override parameters you **explicitly set** — unset parameters fall through to Global Defaults.
- Per-chat options are saved in the conversation draft and never affect other conversations.
- The **"Save as model default"** button in the Advanced Options panel promotes the current chat values to Per-Model Defaults.

**Example — Temperature:**
Global default: `0.8` | llama3.2 model default: `0.4` | This chat: not changed → Ollama receives **0.4**

**Example — Stop Sequences:**
Global default: `["###"]` | Model default: not set | This chat: `["&lt;END&gt;", "---"]` → Ollama receives **["&lt;END&gt;", "---"]**

---

## Where to Change Settings

| What you want | Where to go |
|---|---|
| Change defaults for all future conversations | **Settings → Advanced** tab |
| Change defaults for a specific model | **Models** tab → click the model → **Edit Defaults** |
| Change options for just this conversation | Chat panel → **Advanced Options** (⚙ icon) |
| Apply a named bundle of settings at once | Advanced Options panel → **Preset** selector |

---

## Parameter Reference

### Temperature & Sampling

| Parameter | Range | Default | Description |
|---|---|---|---|
| Temperature | 0.0–2.0 | 0.8 | Controls randomness. Lower = more deterministic, higher = more creative and varied. |
| Top-P | 0.0–1.0 | 0.9 | Nucleus sampling. Model only samples from tokens that together sum to this probability mass. |
| Top-K | 1–100 | 40 | Limits the vocabulary to the K most likely tokens at each step. |

::: tip
Top-P and Top-K are hidden in the Advanced Options panel when **Mirostat** is active — they have no effect while Mirostat controls sampling.
:::

### Mirostat

Mirostat is an adaptive sampling algorithm that targets a specific "perplexity" level instead of using fixed Top-P/Top-K cutoffs. It tends to produce more coherent long-form text.

| Mode | Description |
|---|---|
| Off | Standard Top-P / Top-K sampling (default) |
| Mirostat 1 | First-generation algorithm |
| Mirostat 2 | Improved version — recommended if you want to use Mirostat |

| Parameter | Range | Default | Description |
|---|---|---|---|
| Tau (τ) | 0.0–10.0 | 5.0 | Target entropy. Lower = more focused output, higher = more varied. |
| Eta (η) | 0.0–1.0 | 0.1 | Learning rate — how quickly the algorithm adapts to the target perplexity. |

### Context Window

| Parameter | Range | Default | Description |
|---|---|---|---|
| num_ctx | 512–131072 | model default | Number of tokens the model sees at once. Larger values support longer conversations but require more VRAM. |

::: warning
Setting `num_ctx` higher than the model's trained context length does not improve quality and wastes memory. Check the model's page on the Ollama library for the recommended value.
:::

### Repetition Control

| Parameter | Range | Default | Description |
|---|---|---|---|
| Repeat penalty | 0.0–2.0 | 1.1 | Penalises recently used tokens. Values above 1.0 discourage repetition; values below 1.0 encourage it. |
| Repeat last N | 0–512 | 64 | How many previous tokens to check when applying the repeat penalty. |

### Stop Sequences

Custom tokens that signal the model to stop generating. Useful for structured outputs or prompt-chaining.

- Configure up to 4 stop tokens in **Settings → Advanced → Stop Sequences** (global) or in **Advanced Options** (per-chat).
- Common examples: `###`, `&lt;END&gt;`, `\n\n`, `Human:`.
- An empty list omits the `stop` field entirely — the model generates until its natural end token.

### Seed

A fixed seed makes generation reproducible — the same prompt with the same model and the same seed always produces the same output.

- Set in **Advanced Options → Seed** (per-chat) or **Settings → Advanced → Seed** (global default).
- When a fixed seed is active, the seed value appears in the **message performance metadata** row (the tokens/s line below each response).
- Set to `-1` or leave blank for random generation each time.

### System Prompt

A system-level instruction prepended to every conversation. The model sees it before your first message.

- Set per-conversation in the **System Prompt** field at the top of the chat panel.
- Stored as a `system` role message in SQLite.
- System prompts are always per-conversation — they are not affected by model defaults or global settings.

### Preset Profiles

Presets are named bundles of generation settings you can apply with one click from the Advanced Options panel.

**Built-in presets:**

| Preset | Temperature | Top-P | Best for |
|---|---|---|---|
| Creative | 1.2 | 0.95 | Brainstorming, fiction, open-ended questions |
| Balanced | 0.8 | 0.9 | General-purpose chat |
| Precise | 0.2 | 0.7 | Factual questions, structured data, code review |
| Code | 0.1 | 0.85 | Code generation and completion |

**User-defined presets:**
- Save your current Advanced Options values as a named preset using the **Save preset** button.
- Delete presets you no longer need via the preset menu.
- The active preset name is shown in the Advanced Options panel header.
- Presets are persisted per-conversation in the draft — switching conversations restores that conversation's preset selection.
