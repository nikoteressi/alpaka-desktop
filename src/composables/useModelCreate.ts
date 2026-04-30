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
    try {
      await invoke("create_model", { name, modelfile });
    } catch (e) {
      // invoke() rejected before the backend could emit model:create-error — mark as error
      if (modelStore.creating[name]?.phase === "running") {
        modelStore.creating[name].phase = "error";
        modelStore.creating[name].error =
          e instanceof Error ? e.message : String(e);
      }
      throw e;
    }
  }

  async function cancel(name: string): Promise<void> {
    await invoke("cancel_model_create", { name });
  }

  return { start, cancel };
}
