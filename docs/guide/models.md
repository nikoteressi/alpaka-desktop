# Model Management

## Browsing Local Models

The **Models → Local** tab lists all models you have pulled. For each model you can see:
- Parameter count, quantization, and file size
- GPU/VRAM requirements (detected from your hardware via `detect_hardware`)
- Custom tags and favorite status

Click a model to open its detail panel, where you can view the full Ollama model card, available tags, and edit per-model generation defaults.

## Pulling Models

1. Go to **Models → Library** and search for a model name.
2. Click a model to see available tags (e.g. `7b`, `13b`, `instruct`, `q4_K_M`).
3. Click **Pull** to start downloading. Progress is shown in real time.
4. The model appears in the Local tab once complete.

You can also pull directly by name: open a conversation, type the model name into the model selector, and Alpaka Desktop will prompt you to pull it.

## Deleting Models

In **Models → Local**, click the three-dot menu on any model → **Delete**. The model is removed from disk via `ollama rm`.

## Tags and Favorites

- **Favorite** a model (⭐) to float it to the top of the model selector.
- **Tags** are custom text labels you apply to models (e.g. `coding`, `fast`, `vision`).
- Filter the local model list and the chat model selector by tag.

## Custom Model Creation (Modelfile)

Alpaka Desktop includes a full Modelfile editor (CodeMirror) for creating custom Ollama models:

1. Go to **Models → Create**.
2. Write your Modelfile (see the [Ollama Modelfile reference](https://github.com/ollama/ollama/blob/main/docs/modelfile.md)).
3. Click **Create**. Progress streams in real time; you can cancel mid-stream.
4. A desktop notification confirms when the model is ready.

## Storage Path

By default, Ollama stores model blobs in `~/.ollama/models`. To change this:

1. Go to **Settings → Engine → Model Storage Path**.
2. Enter the new absolute path.
3. Click **Save**. Alpaka Desktop writes a systemd service override (`OLLAMA_MODELS`) and restarts the Ollama service automatically.

::: warning
Changing the storage path does not move existing models. You must manually move the `~/.ollama/models/` directory contents to the new path before saving, or re-pull models after the change.
:::
