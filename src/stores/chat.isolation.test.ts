import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("useChatStore — no Vue context required", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("can be instantiated without a component tree", async () => {
    const { useChatStore } = await import("./chat");
    expect(() => useChatStore()).not.toThrow();
  });

  it("loadConversations calls invoke list_conversations", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValue([]);

    const { useChatStore } = await import("./chat");
    const store = useChatStore();
    await store.loadConversations(true);
    expect(mockInvoke).toHaveBeenCalledWith(
      "list_conversations",
      expect.any(Object),
    );
  });

  it("clearMessages removes cached messages for a conversation", async () => {
    const { useChatStore } = await import("./chat");
    const store = useChatStore();
    store.messages["conv-1"] = [];
    store.clearMessages("conv-1");
    expect(store.messages["conv-1"]).toBeUndefined();
  });

  it("appendCompactionToken accumulates tokens", async () => {
    const { useChatStore } = await import("./chat");
    const store = useChatStore();
    store.appendCompactionToken("conv-1", "Hello");
    store.appendCompactionToken("conv-1", " world");
    expect(store.compactionTokens["conv-1"]).toBe("Hello world");
  });

  it("finishCompaction clears compaction state and archived cache", async () => {
    const { useChatStore } = await import("./chat");
    const store = useChatStore();
    store.compactionInProgress["conv-1"] = true;
    store.compactionTokens["conv-1"] = "summary text";
    store.archivedMessages["conv-1"] = [];
    store.finishCompaction("conv-1");
    expect(store.compactionInProgress["conv-1"]).toBeUndefined();
    expect(store.compactionTokens["conv-1"]).toBeUndefined();
    expect(store.archivedMessages["conv-1"]).toBeUndefined();
  });

  it("loadArchivedMessages stores mapped messages from invoke", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_archived_messages")
        return Promise.resolve([
          {
            id: "m1",
            conversation_id: "conv-1",
            role: "user",
            content: "hi",
            images_json: null,
            files_json: null,
            tokens_used: null,
            generation_time_ms: null,
            prompt_tokens: null,
            tokens_per_sec: null,
            total_duration_ms: null,
            load_duration_ms: null,
            prompt_eval_duration_ms: null,
            eval_duration_ms: null,
            seed: null,
            created_at: "2026-01-01T00:00:00Z",
            parent_id: null,
            sibling_order: 0,
            sibling_count: 1,
            is_active: true,
            is_archived: true,
          },
        ]);
      return Promise.resolve([]);
    });

    const { useChatStore } = await import("./chat");
    const store = useChatStore();
    await store.loadArchivedMessages("conv-1");

    expect(store.archivedMessages["conv-1"]).toHaveLength(1);
    expect(store.archivedMessages["conv-1"][0].content).toBe("hi");
  });

  it("toggleHistory loads archived messages on first toggle", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValue([]);

    const { useChatStore } = await import("./chat");
    const store = useChatStore();
    await store.toggleHistory("conv-1");

    expect(store.showingHistory.has("conv-1")).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith("get_archived_messages", {
      conversationId: "conv-1",
    });

    await store.toggleHistory("conv-1");
    expect(store.showingHistory.has("conv-1")).toBe(false);
  });

  it("cancelCompaction calls invoke cancel_compaction", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValue(undefined);

    const { useChatStore } = await import("./chat");
    const store = useChatStore();
    await store.cancelCompaction();

    expect(mockInvoke).toHaveBeenCalledWith("cancel_compaction");
  });

  it("compactConversation invokes backend and delegates cleanup to compact:done event", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockResolvedValue(undefined);

    const { useChatStore } = await import("./chat");
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];

    await store.compactConversation("conv-1", "llama3");

    expect(mockInvoke).toHaveBeenCalledWith("compact_conversation", {
      conversationId: "conv-1",
      model: "llama3",
    });
    // On success, cleanup is owned by the compact:done event handler.
    // compactionInProgress stays true until the event fires.
    expect(store.compactionInProgress["conv-1"]).toBe(true);
    // Messages cache is NOT touched here — the event handler clears it.
    expect(store.messages["conv-1"]).toEqual([]);
  });

  it("compactConversation calls finishCompaction on error", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockRejectedValue(new Error("backend error"));

    const { useChatStore } = await import("./chat");
    const store = useChatStore();
    store.compactionInProgress["conv-1"] = true;
    store.compactionTokens["conv-1"] = "";

    await store.compactConversation("conv-1", "llama3");

    expect(store.compactionInProgress["conv-1"]).toBeUndefined();
    expect(store.compactionTokens["conv-1"]).toBeUndefined();
  });
});
