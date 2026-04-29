import { invoke } from "@tauri-apps/api/core";
import type { ChatOptions } from "../types/settings";

async function resetModelDefaults(model: string): Promise<void> {
  await invoke("reset_model_defaults", { modelName: model });
}

export function useModelDefaults() {
  // Returns stored overrides only. Callers are responsible for falling back
  // to settingsStore.chatOptions for any key not present in the returned object.
  async function applyModelDefaults(
    model: string,
  ): Promise<Partial<ChatOptions>> {
    const stored = await invoke<Partial<ChatOptions> | null>(
      "get_model_defaults",
      {
        modelName: model,
      },
    );
    return stored ?? {};
  }

  async function saveAsModelDefault(
    model: string,
    options: Partial<ChatOptions>,
  ): Promise<void> {
    await invoke("set_model_defaults", { modelName: model, defaults: options });
  }

  return { applyModelDefaults, saveAsModelDefault, resetModelDefaults };
}
