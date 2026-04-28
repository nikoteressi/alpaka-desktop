import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chat";
import type { Conversation, ChatDraft } from "../types/chat";

const DRAFT_ID_PREFIX = "__draft__";

function makeDraftConversation(model: string): Conversation {
  return {
    // Math.random() suffix prevents collision on rapid double-click (same millisecond)
    id:
      DRAFT_ID_PREFIX + Date.now() + "_" + Math.random().toString(36).slice(2),
    title: "New Chat",
    model,
    settings_json: "{}",
    pinned: false,
    tags: [],
    draft_json: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function useDraftManager() {
  const store = useChatStore();

  function startNewChat(model: string = "") {
    if (store.draftConversation) {
      delete store.messages[store.draftConversation.id];
    }
    store.draftSystemPrompt = "";
    const draft = makeDraftConversation(model);
    store.draftConversation = draft;
    store.messages[draft.id] = [];
    store.activeConversationId = draft.id;
  }

  async function persistDraft(): Promise<string> {
    if (!store.draftConversation) throw new Error("No draft to persist");
    if (!store.draftConversation.model?.trim()) {
      throw new Error("Please select a model before starting a conversation");
    }

    const draft = store.draftConversation;
    const conv = await invoke<Conversation>("create_conversation", {
      model: draft.model,
      title: draft.title,
      systemPrompt: store.draftSystemPrompt || null,
    });

    const draftMessages = store.messages[draft.id] ?? [];
    store.messages[conv.id] = draftMessages;
    delete store.messages[draft.id];

    if (store.folderContexts[draft.id]) {
      store.folderContexts[conv.id] = store.folderContexts[draft.id];
      delete store.folderContexts[draft.id];
    }

    if (store.drafts[draft.id]) {
      store.drafts[conv.id] = store.drafts[draft.id];
      delete store.drafts[draft.id];
    }

    store.conversations.unshift(conv);
    store.activeConversationId = conv.id;
    store.draftConversation = null;

    await store.loadConversation(conv.id);
    return conv.id;
  }

  function setDraft(conversationId: string, draft: ChatDraft) {
    store.drafts[conversationId] = draft;
    saveDraftToDb(conversationId, draft);
  }

  async function saveDraftToDb(conversationId: string, draft: ChatDraft) {
    if (conversationId.startsWith(DRAFT_ID_PREFIX)) return;
    try {
      await invoke("update_chat_draft", {
        conversation_id: conversationId,
        draft_json: JSON.stringify(draft),
      });
      const conv = store.conversations.find((c) => c.id === conversationId);
      if (conv) conv.draft_json = JSON.stringify(draft);
    } catch (err) {
      console.warn("Failed to save draft to DB", err);
    }
  }

  async function clearDraft(conversationId: string) {
    delete store.drafts[conversationId];
    const conv = store.conversations.find((c) => c.id === conversationId);
    if (conv) conv.draft_json = null;
    try {
      await invoke("update_chat_draft", {
        conversation_id: conversationId,
        draft_json: null,
      });
    } catch (err) {
      console.warn("Failed to clear draft from DB", err);
    }
  }

  return { startNewChat, persistDraft, setDraft, saveDraftToDb, clearDraft };
}
