import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chat";
import type { Conversation } from "../types/chat";
import { DRAFT_ID_PREFIX } from "../lib/constants";

export function useConversationLifecycle() {
  const store = useChatStore();

  async function createConversation(
    model?: string,
    systemPrompt?: string,
  ): Promise<string> {
    const finalModel = model?.trim() || "";
    if (!finalModel)
      throw new Error("A model must be specified to create a conversation");

    const conv = await invoke<Conversation>("create_conversation", {
      model: finalModel,
      title: null,
      systemPrompt: systemPrompt ?? null,
    });
    store.conversations.unshift(conv);
    await store.loadConversation(conv.id);
    store.activeConversationId = conv.id;
    return conv.id;
  }

  async function updateTitle(id: string, title: string): Promise<void> {
    const conv = store.conversations.find((c) => c.id === id);
    if (!conv) return;
    const oldTitle = conv.title;
    conv.title = title;
    try {
      await invoke("update_conversation_title", { conversationId: id, title });
    } catch (err) {
      conv.title = oldTitle;
      throw err;
    }
  }

  async function setPinned(id: string, pinned: boolean): Promise<void> {
    await invoke("set_conversation_pinned", { conversationId: id, pinned });
    const conv = store.conversations.find((c) => c.id === id);
    if (conv) conv.pinned = pinned;
  }

  async function updateSystemPrompt(
    id: string,
    systemPrompt: string,
  ): Promise<void> {
    if (id.startsWith(DRAFT_ID_PREFIX)) {
      store.draftSystemPrompt = systemPrompt;
      return;
    }

    await invoke("update_system_prompt", { conversationId: id, systemPrompt });

    if (store.messages[id]) {
      const msg = store.messages[id].find((m) => m.role === "system");
      if (msg) {
        msg.content = systemPrompt;
      } else if (systemPrompt) {
        await store.loadConversation(id);
      }
    }
  }

  async function deleteConversation(id: string): Promise<void> {
    await invoke("delete_conversation", { conversationId: id });
    const idx = store.conversations.findIndex((c) => c.id === id);
    if (idx !== -1) store.conversations.splice(idx, 1);
    delete store.messages[id];
    delete store.folderContexts[id];
    if (store.activeConversationId === id) {
      store.activeConversationId = store.conversations[0]?.id ?? null;
    }
  }

  return {
    createConversation,
    updateTitle,
    setPinned,
    updateSystemPrompt,
    deleteConversation,
  };
}
