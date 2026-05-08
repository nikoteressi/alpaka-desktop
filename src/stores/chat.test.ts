import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useChatStore } from "./chat";
import type { LinkedContext } from "../types/chat";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => mockInvoke(cmd, args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const MOCK_CONV = {
  id: "backend-uuid-123",
  title: "New Chat",
  model: "llama3:latest",
  settings_json: "{}",
  pinned: false,
  tags: [] as string[],
  draft_json: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("useChatStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();

    // Default mocks for common commands to prevent crashes
    mockInvoke.mockImplementation(async (cmd, _args) => {
      if (cmd === "get_messages") return [];
      if (cmd === "get_all_settings") return {};
      if (cmd === "list_conversations") return [];
      if (cmd === "get_folder_contexts") return [];
      return null;
    });
  });

  it("loadConversation calls get_messages with correct conversationId", async () => {
    const store = useChatStore();
    const backendMessages = [
      {
        id: "msg-1",
        conversation_id: "conv-1",
        role: "user",
        content: "Hello",
        images_json: "[]",
        files_json: "[]",
        tokens_used: null,
        generation_time_ms: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "msg-2",
        conversation_id: "conv-1",
        role: "assistant",
        content: "Hi there",
        images_json: "[]",
        files_json: "[]",
        tokens_used: 10,
        generation_time_ms: 500,
        created_at: "2026-01-01T00:00:01Z",
      },
    ];
    mockInvoke.mockResolvedValue(backendMessages);

    await store.loadConversation("conv-1");

    expect(mockInvoke).toHaveBeenCalledWith("get_messages", {
      conversationId: "conv-1",
    });
    expect(store.activeConversationId).toBe("conv-1");
    expect(store.messages["conv-1"]).toHaveLength(2);
    expect(store.messages["conv-1"][0].role).toBe("user");
    expect(store.messages["conv-1"][0].content).toBe("Hello");
  });

  it("finalizeStreamedMessage adds assistant message and resets buffers", () => {
    const store = useChatStore();
    store.messages["conv-1"] = [];
    store.streaming.buffer = "Hello world";
    store.streaming.thinkingBuffer = "";

    store.finalizeStreamedMessage("conv-1");

    expect(store.messages["conv-1"]).toHaveLength(1);
    expect(store.messages["conv-1"][0].role).toBe("assistant");
    expect(store.messages["conv-1"][0].content).toBe("Hello world");
    expect(store.streaming.buffer).toBe("");
  });

  it("finalizeStreamedMessage wraps thinking content in <think> tags", () => {
    const store = useChatStore();
    store.messages["conv-1"] = [];
    store.streaming.buffer = "Answer";
    store.streaming.thinkingBuffer = "internal reasoning";

    store.finalizeStreamedMessage("conv-1");

    const content = store.messages["conv-1"][0].content;
    expect(content).toContain("<think>");
    expect(content).toContain("internal reasoning");
    expect(content).toContain("Answer");
  });

  it("propagates seed onto the pushed message", () => {
    const store = useChatStore();
    store.messages["conv-1"] = [];
    store.streaming.buffer = "reply";

    store.finalizeStreamedMessage("conv-1", { seed: 42 });

    expect(store.messages["conv-1"][0].seed).toBe(42);
  });

  it("leaves seed undefined when not provided", () => {
    const store = useChatStore();
    store.messages["conv-2"] = [];
    store.streaming.buffer = "reply";

    store.finalizeStreamedMessage("conv-2");

    expect(store.messages["conv-2"][0].seed).toBeUndefined();
  });

  it("treats JSON null seed (Rust None) as undefined in finalizeStreamedMessage", () => {
    const store = useChatStore();
    store.messages["conv-3"] = [];
    store.streaming.buffer = "reply";

    store.finalizeStreamedMessage("conv-3", {
      seed: null as unknown as undefined,
    });

    expect(store.messages["conv-3"][0].seed).toBeUndefined();
  });

  it("treats JSON null seed (Rust None) as undefined in loadConversation", async () => {
    const store = useChatStore();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "get_messages") {
        return [
          {
            id: "msg-null-seed",
            conversation_id: "conv-null",
            role: "assistant",
            content: "Hello",
            images_json: "[]",
            files_json: "[]",
            tokens_used: 5,
            generation_time_ms: 100,
            seed: null,
            created_at: "2026-01-01T00:00:00Z",
          },
        ];
      }
      if (cmd === "get_folder_contexts") return [];
      return null;
    });

    await store.loadConversation("conv-null");

    expect(store.messages["conv-null"][0].seed).toBeUndefined();
  });

  // --- addFolderContext ---

  it("addFolderContext adds a context to folderContexts[conversationId]", () => {
    const store = useChatStore();
    const ctx: LinkedContext = {
      id: "ctx-1",
      name: "folder",
      path: "/tmp/folder",
      content: "...",
      tokens: 100,
    };
    store.addFolderContext("conv-1", ctx);
    expect(store.folderContexts["conv-1"]).toHaveLength(1);
    expect(store.folderContexts["conv-1"][0].id).toBe("ctx-1");
  });

  it("addFolderContext skips duplicate entries by path", () => {
    const store = useChatStore();
    const ctx: LinkedContext = {
      id: "ctx-1",
      name: "folder",
      path: "/tmp/folder",
      content: "...",
      tokens: 100,
    };
    const ctxDup: LinkedContext = {
      id: "ctx-2",
      name: "folder-dup",
      path: "/tmp/folder",
      content: "other",
      tokens: 50,
    };
    store.addFolderContext("conv-1", ctx);
    store.addFolderContext("conv-1", ctxDup);
    expect(store.folderContexts["conv-1"]).toHaveLength(1);
    expect(store.folderContexts["conv-1"][0].id).toBe("ctx-1");
  });

  // --- removeFolderContext ---

  it("removeFolderContext removes a context by contextId", () => {
    const store = useChatStore();
    const ctx: LinkedContext = {
      id: "ctx-1",
      name: "folder",
      path: "/tmp/folder",
      content: "...",
      tokens: 100,
    };
    store.addFolderContext("conv-1", ctx);
    store.removeFolderContext("conv-1", "ctx-1");
    expect(store.folderContexts["conv-1"]).toHaveLength(0);
  });

  it("removeFolderContext is a no-op when conversationId not in folderContexts", () => {
    const store = useChatStore();
    expect(() =>
      store.removeFolderContext("nonexistent", "ctx-1"),
    ).not.toThrow();
    expect(store.folderContexts["nonexistent"]).toBeUndefined();
  });

  // --- clearFolderContext ---

  it("clearFolderContext deletes folderContexts[conversationId] entirely", () => {
    const store = useChatStore();
    const ctx: LinkedContext = {
      id: "ctx-1",
      name: "folder",
      path: "/tmp/folder",
      content: "...",
      tokens: 100,
    };
    store.addFolderContext("conv-1", ctx);
    expect(store.folderContexts["conv-1"]).toBeDefined();
    store.clearFolderContext("conv-1");
    expect(store.folderContexts["conv-1"]).toBeUndefined();
  });

  // --- compactConversation ---

  it("compactConversation calls invoke('compact_conversation') with conversationId and model", async () => {
    const store = useChatStore();
    mockInvoke.mockImplementation(async (cmd, _args) => {
      if (cmd === "compact_conversation") return null;
      if (cmd === "get_messages") return [];
      if (cmd === "get_folder_contexts") return [];
      return null;
    });

    await store.compactConversation("old-conv-id", "llama3:latest");
    expect(mockInvoke).toHaveBeenCalledWith("compact_conversation", {
      conversationId: "old-conv-id",
      model: "llama3:latest",
    });
  });

  it("compactConversation does not reload messages itself (compact:done event owns that)", async () => {
    const store = useChatStore();
    store.activeConversationId = "old-conv-id";
    mockInvoke.mockResolvedValue(null);

    await store.compactConversation("old-conv-id", "llama3:latest");

    // Reload is delegated to the compact:done event handler, not done inline.
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "get_messages",
      expect.anything(),
    );
  });

  it("loadConversations handles pagination and appends to existing list", async () => {
    const store = useChatStore();
    const page1 = Array.from({ length: 20 }, (_, i) => ({
      ...MOCK_CONV,
      id: `c${i}`,
    }));
    const page2 = [{ ...MOCK_CONV, id: "next-page-item" }];

    mockInvoke.mockImplementation(async (cmd, args) => {
      if (cmd === "list_conversations") {
        if (args.offset === 0) return page1;
        if (args.offset === 20) return page2;
        return [];
      }
      if (cmd === "get_messages") return [];
      if (cmd === "get_all_settings") return {};
      if (cmd === "get_folder_contexts") return [];
      return null;
    });

    await store.loadConversations(true); // Initial load (reset = true)
    expect(store.conversations).toHaveLength(20);

    await store.loadConversations(false); // Load more (reset = false)
    expect(store.conversations).toHaveLength(21);
    expect(mockInvoke).toHaveBeenLastCalledWith("list_conversations", {
      limit: 20,
      offset: 20,
    });
  });
});
