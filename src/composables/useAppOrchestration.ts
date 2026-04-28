import { useHostStore } from "../stores/hosts";
import { useModelStore } from "../stores/models";
import { useChatStore } from "../stores/chat";
import { useDraftManager } from "./useDraftManager";

export function useAppOrchestration() {
  const hostStore = useHostStore();
  const modelStore = useModelStore();
  const chatStore = useChatStore();
  const { startNewChat: draftStartNewChat } = useDraftManager();

  /**
   * Switches the active host and coordinates side effects like refreshing models.
   */
  async function switchHost(hostId: string) {
    if (hostStore.activeHostId === hostId) return;

    try {
      await hostStore.setActiveHost(hostId);

      // Coordinate model refresh
      modelStore.models = [];
      await modelStore.fetchModels();
    } catch (e) {
      console.error("[Orchestration] Failed to coordinate host switch:", e);
    }
  }

  /**
   * Resolves the best default model and starts a new chat.
   */
  function startNewChat(requestedModel?: string) {
    let model = requestedModel;

    if (!model) {
      // 1. Try last used model from most recent conversation
      const lastConv = chatStore.conversations[0];
      if (lastConv?.model) {
        model = lastConv.model;
      } else {
        // 2. Try first installed model
        model = modelStore.models[0]?.name ?? "";
      }
    }

    draftStartNewChat(model);
  }

  return {
    switchHost,
    startNewChat,
  };
}
