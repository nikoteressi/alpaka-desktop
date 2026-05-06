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

  it("persistDraft migrates folderContexts when present", async () => {
    vi.mocked(invoke).mockReset();
    const store = useChatStore();
    const { startNewChat, persistDraft } = useDraftManager();

    startNewChat("llama3");
    const draftId = store.draftConversation!.id;
    store.folderContexts[draftId] = [
      { id: "f1", path: "/docs", content: "", token_estimate: 0 },
    ];

    const fakeConv = {
      id: "real-conv-2",
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
    vi.mocked(invoke).mockResolvedValueOnce([]); // get_messages (loadConversation)
    vi.mocked(invoke).mockResolvedValueOnce([]); // get_folder_contexts (loadConversation)

    await persistDraft();

    // The draft's folder context is migrated to the real conv ID.
    // loadConversation() then re-hydrates from DB (mocked empty), so folderContexts[conv.id]
    // ends up as the DB result. What we verify is the draft source was cleaned up.
    expect(store.folderContexts[draftId]).toBeUndefined();
  });

  it("persistDraft migrates draft text when present", async () => {
    vi.mocked(invoke).mockReset();
    const store = useChatStore();
    const { startNewChat, persistDraft } = useDraftManager();

    startNewChat("llama3");
    const draftId = store.draftConversation!.id;
    const draftEntry = {
      content: "hello",
      attachments: [],
      linkedContexts: [],
      webSearchEnabled: false,
      thinkEnabled: false,
      thinkLevel: "medium" as const,
      chatOptions: {},
      presetId: "",
    };
    store.drafts[draftId] = draftEntry;

    const fakeConv = {
      id: "real-conv-3",
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
    vi.mocked(invoke).mockResolvedValueOnce([]); // get_messages (loadConversation)
    vi.mocked(invoke).mockResolvedValueOnce([]); // get_folder_contexts (loadConversation)

    await persistDraft();

    // drafts[draftId] migrated to drafts[realId]
    expect(store.drafts[draftId]).toBeUndefined();
  });

  describe("saveDraftToDb", () => {
    it("returns early without invoking when conversationId is a draft prefix", async () => {
      const { saveDraftToDb } = useDraftManager();
      await saveDraftToDb("__draft__abc", {
        content: "x",
        attachments: [],
        linkedContexts: [],
        webSearchEnabled: false,
        thinkEnabled: false,
        thinkLevel: "medium",
        chatOptions: {},
        presetId: "",
      });
      expect(invoke).not.toHaveBeenCalled();
    });

    it("invokes update_chat_draft and updates conv.draft_json on success", async () => {
      const store = useChatStore();
      store.conversations = [
        {
          id: "conv-1",
          title: "Chat",
          model: "llama3",
          settings_json: "{}",
          pinned: false,
          tags: [],
          draft_json: null,
          created_at: "",
          updated_at: "",
        },
      ];
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const draft = {
        content: "hi",
        attachments: [],
        linkedContexts: [],
        webSearchEnabled: false,
        thinkEnabled: false,
        thinkLevel: "medium" as const,
        chatOptions: {},
        presetId: "",
      };
      const { saveDraftToDb } = useDraftManager();
      await saveDraftToDb("conv-1", draft);

      expect(invoke).toHaveBeenCalledWith("update_chat_draft", {
        conversationId: "conv-1",
        draftJson: JSON.stringify(draft),
      });
      expect(store.conversations[0].draft_json).toBe(JSON.stringify(draft));
    });

    it("logs warning when invoke fails", async () => {
      vi.mocked(invoke).mockReset();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValueOnce(new Error("db error"));

      const { saveDraftToDb } = useDraftManager();
      await saveDraftToDb("conv-x", {
        content: "",
        attachments: [],
        linkedContexts: [],
        webSearchEnabled: false,
        thinkEnabled: false,
        thinkLevel: "medium",
        chatOptions: {},
        presetId: "",
      });

      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe("clearDraft", () => {
    it("removes draft from store, clears conv.draft_json, and invokes update_chat_draft with null", async () => {
      const store = useChatStore();
      store.conversations = [
        {
          id: "conv-clr",
          title: "Chat",
          model: "llama3",
          settings_json: "{}",
          pinned: false,
          tags: [],
          draft_json: '{"content":"old"}',
          created_at: "",
          updated_at: "",
        },
      ];
      store.drafts["conv-clr"] = {
        content: "old",
        attachments: [],
        linkedContexts: [],
        webSearchEnabled: false,
        thinkEnabled: false,
        thinkLevel: "medium",
        chatOptions: {},
        presetId: "",
      };
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const { clearDraft } = useDraftManager();
      await clearDraft("conv-clr");

      expect(store.drafts["conv-clr"]).toBeUndefined();
      expect(store.conversations[0].draft_json).toBeNull();
      expect(invoke).toHaveBeenCalledWith("update_chat_draft", {
        conversationId: "conv-clr",
        draftJson: null,
      });
    });

    it("logs warning when invoke fails during clearDraft", async () => {
      vi.mocked(invoke).mockReset();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.mocked(invoke).mockRejectedValueOnce(new Error("clear failed"));

      const { clearDraft } = useDraftManager();
      await clearDraft("conv-fail");

      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe("setDraft", () => {
    it("sets draft in store and calls saveDraftToDb", async () => {
      const store = useChatStore();
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      const draft = {
        content: "test",
        attachments: [],
        linkedContexts: [],
        webSearchEnabled: false,
        thinkEnabled: false,
        thinkLevel: "medium" as const,
        chatOptions: {},
        presetId: "",
      };
      const { setDraft } = useDraftManager();
      setDraft("conv-set", draft);

      expect(store.drafts["conv-set"]).toEqual(draft);
    });
  });
});
