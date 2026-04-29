import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/settings";
import type { ChatOptions } from "../types/settings";

export function useModelDefaults() {
  const settingsStore = useSettingsStore();

  async function applyModelDefaults(model: string): Promise<Partial<ChatOptions>> {
    const stored = await invoke<Partial<ChatOptions> | null>("get_model_defaults", {
      modelName: model,
    });
    if (stored) return stored;
    return { ...settingsStore.chatOptions };
  }

  async function saveAsModelDefault(
    model: string,
    options: Partial<ChatOptions>,
  ): Promise<void> {
    await invoke("set_model_defaults", { modelName: model, defaults: options });
  }

  return { applyModelDefaults, saveAsModelDefault };
}
