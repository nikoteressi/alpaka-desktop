import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { useDraftManager } from "./useDraftManager";
import { useChatStore } from "../stores/chat";

describe("useDraftManager", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("startNewChat creates a draft conversation with the given model", () => {
    const { startNewChat } = useDraftManager();
    const store = useChatStore();

    startNewChat("llama3");

    expect(store.draftConversation).not.toBeNull();
    expect(store.draftConversation?.model).toBe("llama3");
    expect(store.activeConversationId).toMatch(/^__draft__/);
  });

  it("startNewChat cleans up previous draft messages", () => {
    const { startNewChat } = useDraftManager();
    const store = useChatStore();

    startNewChat("llama3");
    const firstDraftId = store.draftConversation!.id;
    store.messages[firstDraftId] = [
      { role: "user", content: "hi", images: [] },
    ];

    startNewChat("gemma");

    expect(store.messages[firstDraftId]).toBeUndefined();
  });

  it("persistDraft throws if no draft exists", async () => {
    const { persistDraft } = useDraftManager();
    await expect(persistDraft()).rejects.toThrow("No draft to persist");
  });

  it("persistDraft throws if model is not selected", async () => {
    const { startNewChat, persistDraft } = useDraftManager();
    startNewChat("");
    await expect(persistDraft()).rejects.toThrow("Please select a model");
  });

  it("persistDraft creates conversation, migrates messages, and resets draft state", async () => {
    const store = useChatStore();
    const { startNewChat, persistDraft } = useDraftManager();

    startNewChat("llama3");
    const draftId = store.draftConversation!.id;
    store.messages[draftId] = [{ role: "user", content: "hello", images: [] }];

    const fakeConv = {
      id: "real-conv-1",
      model: "llama3",
      title: "New Chat",
      settings_json: "{}",
      pinned: false,
      tags: [],
      draft_json: null,
      created_at: "",
      updated_at: "",
    };
    vi.mocked(invoke).mockResolvedValueOnce(fakeConv); // create_conversation
    vi.mocked(invoke).mockResolvedValueOnce([]); // loadConversation -> list_messages

    await persistDraft();

    expect(store.draftConversation).toBeNull();
    expect(store.activeConversationId).toBe("real-conv-1");
    expect(store.conversations[0].id).toBe("real-conv-1");
    // messages migrated from draft ID to real ID
    expect(store.messages["real-conv-1"]).toHaveLength(1);
    expect(store.messages[draftId]).toBeUndefined();
  });
});
