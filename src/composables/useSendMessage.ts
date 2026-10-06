import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chat";
import { useDraftManager } from "./useDraftManager";
import { useConversationLifecycle } from "./useConversationLifecycle";
import type { ChatOptions } from "../types/settings";
import { DRAFT_ID_PREFIX } from "../lib/constants";

export function useSendMessage() {
  const store = useChatStore();
  const { persistDraft, clearDraft } = useDraftManager();
  const { updateTitle } = useConversationLifecycle();

  async function sendMessage(
    content: string,
    images?: Uint8Array[],
    webSearchEnabled?: boolean,
    thinkMode?: string,
    chatOptions?: ChatOptions,
  ) {
    // If we're in a draft conversation, persist it first
    if (
      store.draftConversation &&
      store.activeConversationId?.startsWith(DRAFT_ID_PREFIX)
    ) {
      await persistDraft();
    }

    if (!store.activeConversationId) {
      throw new Error("No active conversation");
    }

    const conversationId = store.activeConversationId;

    // Fire-and-forget — must not await here or it blocks optimistic UI update
    // (clearDraft internally calls invoke which may be slow)
    void clearDraft(conversationId);

    store.streaming = {
      isStreaming: true,
      currentConversationId: conversationId,
      buffer: "",
      thinkingBuffer: "",
      isThinking: false,
      tokensPerSec: null,
      thinkTime: null,
      toolCalls: [],
      searchState: null,
      searchResults: [],
      sidebarOpen: false,
      activeSearchMessageId: null,
      activeSearchData: [],
      promptTokens: store.totalActiveTokens,
      evalTokens: 0,
      activeMessageParts: [],
      regeneratingMessageId: null,
    };

    // Snapshot message state before push — used for rollback on invoke failure
    const messagesBefore = [...(store.messages[conversationId] ?? [])];

    store.messages[conversationId].push({
      role: "user",
      content,
      images: images ?? [],
    });

    // Auto-rename "New Chat" based on the first message snippet
    const currentTitle = store.activeConversation?.title || "";
    if (
      currentTitle.trim().toLowerCase() === "new chat" &&
      store.messages[conversationId].length === 1
    ) {
      const snippet = content.trim().split("\n")[0].substring(0, 200).trim();
      if (snippet) {
        updateTitle(conversationId, snippet).catch(() => {});
      }
    }

    try {
      const contexts = store.folderContexts[conversationId] ?? [];
      const folderContextString =
        contexts.length > 0
          ? contexts.map((c) => c.content).join("\n\n")
          : null;

      await invoke("send_message", {
        conversationId,
        content,
        images: images ?? null,
        model: store.activeConversation!.model,
        folderContext: folderContextString,
        webSearchEnabled: webSearchEnabled ?? null,
        thinkMode: thinkMode ?? null,
        chatOptions: chatOptions ?? null,
      });
    } catch (err: unknown) {
      console.error("Failed to send message:", err);
      const currentMsgCount = store.messages[conversationId]?.length ?? 0;
      // If messages grew beyond the optimistic user push, the backend already
      // emitted a chat:error event and onError added an assistant error message —
      // don't roll back or the error message would disappear.
      if (currentMsgCount > messagesBefore.length + 1) {
        store.streaming.isStreaming = false;
      } else {
        // Error occurred before message persistence — roll back the optimistic push.
        store.messages[conversationId] = messagesBefore;
        store.streaming.isStreaming = false;
        throw new Error(`Failed to send message: ${err}`);
      }
    }
  }

  async function stopGeneration() {
    try {
      await invoke("stop_generation");
    } catch (err) {
      console.warn("Failed to stop generation:", err);
    } finally {
      store.streaming.isStreaming = false;
    }
  }

  return { sendMessage, stopGeneration };
}
