import { invoke } from "@tauri-apps/api/core";
import { useModelStore } from "../stores/models";

export function useModelCreate() {
  const modelStore = useModelStore();

  async function start(name: string, modelfile: string): Promise<void> {
    modelStore.creating[name] = {
      name,
      modelfile,
      status: "starting...",
      phase: "running",
      logLines: [],
    };
    await invoke("create_model", { name, modelfile });
  }

  async function cancel(name: string): Promise<void> {
    await invoke("cancel_model_create", { name });
  }

  return { start, cancel };
}
