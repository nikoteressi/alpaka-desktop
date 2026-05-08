import { listen } from "@tauri-apps/api/event";
import { useChatStore } from "../stores/chat";

const _compaction = { cleanup: null as (() => void) | null };

export function useCompactionEvents() {
  const chatStore = useChatStore();

  async function init() {
    if (_compaction.cleanup) {
      _compaction.cleanup();
      _compaction.cleanup = null;
    }

    const unlistenToken = await listen<{
      conversation_id: string;
      content: string;
    }>("compact:token", (event) => {
      chatStore.appendCompactionToken(
        event.payload.conversation_id,
        event.payload.content,
      );
    });

    const unlistenDone = await listen<{ conversation_id: string }>(
      "compact:done",
      (event) => {
        const convId = event.payload.conversation_id;
        chatStore.finishCompaction(convId);
        if (chatStore.activeConversationId === convId) {
          void chatStore.loadConversation(convId);
        }
      },
    );

    const unlistenError = await listen<{
      conversation_id: string;
      error: string;
    }>("compact:error", (event) => {
      chatStore.finishCompaction(event.payload.conversation_id);
      console.error("Compaction error:", event.payload.error);
    });

    _compaction.cleanup = () => {
      unlistenToken();
      unlistenDone();
      unlistenError();
    };
  }

  return { init };
}
