import { invoke } from "@tauri-apps/api/core";
import type { ChatOptions } from "../types/settings";

async function applyModelDefaults(
  model: string,
): Promise<Partial<ChatOptions>> {
  // Returns stored overrides only. Callers are responsible for falling back
  // to settingsStore.chatOptions for any key not present in the returned object.
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

async function resetModelDefaults(model: string): Promise<void> {
  await invoke("reset_model_defaults", { modelName: model });
}

export function useModelDefaults() {
  return { applyModelDefaults, saveAsModelDefault, resetModelDefaults };
}
