import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const mocks = vi.hoisted(() => ({
  persistDraft: vi.fn().mockResolvedValue("conv-1"),
  clearDraft: vi.fn().mockResolvedValue(undefined),
  updateTitle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./useDraftManager", () => ({
  useDraftManager: () => ({
    persistDraft: mocks.persistDraft,
    clearDraft: mocks.clearDraft,
  }),
}));

vi.mock("./useConversationLifecycle", () => ({
  useConversationLifecycle: () => ({
    updateTitle: mocks.updateTitle,
  }),
}));

import { invoke } from "@tauri-apps/api/core";
import { useSendMessage } from "./useSendMessage";
import { useChatStore } from "../stores/chat";

const CONV_BASE = {
  model: "llama3",
  settings_json: "{}",
  pinned: false,
  tags: [],
  draft_json: null,
  created_at: "",
  updated_at: "",
};

function makeConv(id: string, title = "Test") {
  return { id, title, ...CONV_BASE };
}

describe("useSendMessage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.persistDraft.mockResolvedValue("conv-1");
    mocks.clearDraft.mockResolvedValue(undefined);
    mocks.updateTitle.mockResolvedValue(undefined);
  });

  it("optimistically adds user message before invoke", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [makeConv("conv-1")];

    let resolveInvoke!: (value: void | PromiseLike<void>) => void;
    vi.mocked(invoke).mockReturnValue(
      new Promise<void>((r) => {
        resolveInvoke = r;
      }),
    );

    const { sendMessage } = useSendMessage();
    const sendPromise = sendMessage("hello");

    expect(store.messages["conv-1"]).toHaveLength(1);
    expect(store.messages["conv-1"][0].content).toBe("hello");
    expect(store.streaming.isStreaming).toBe(true);

    resolveInvoke();
    await sendPromise;
  });

  it("rolls back user message on invoke failure", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [makeConv("conv-1")];

    vi.mocked(invoke).mockRejectedValue(new Error("Network error"));

    const { sendMessage } = useSendMessage();
    await expect(sendMessage("hello")).rejects.toThrow(
      "Failed to send message",
    );

    expect(store.messages["conv-1"]).toHaveLength(0);
    expect(store.streaming.isStreaming).toBe(false);
  });

  it("throws when no active conversation", async () => {
    const store = useChatStore();
    store.activeConversationId = null;

    const { sendMessage } = useSendMessage();
    await expect(sendMessage("hello")).rejects.toThrow(
      "No active conversation",
    );
  });

  it("persists draft conversation before sending", async () => {
    const store = useChatStore();
    store.activeConversationId = "__draft__conv-draft";
    store.draftConversation = makeConv("__draft__conv-draft");
    store.messages["__draft__conv-draft"] = [];
    store.conversations = [makeConv("__draft__conv-draft")];

    vi.mocked(invoke).mockResolvedValue(undefined);

    const { sendMessage } = useSendMessage();
    await sendMessage("hello").catch(() => {});

    expect(mocks.persistDraft).toHaveBeenCalledOnce();
  });

  it("auto-renames 'New Chat' title on first message", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [makeConv("conv-1", "New Chat")];

    vi.mocked(invoke).mockResolvedValue(undefined);

    const { sendMessage } = useSendMessage();
    await sendMessage("My first message");

    expect(mocks.updateTitle).toHaveBeenCalledWith(
      "conv-1",
      "My first message",
    );
  });

  it("does not auto-rename when title is not 'new chat'", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [makeConv("conv-1", "Existing Title")];

    vi.mocked(invoke).mockResolvedValue(undefined);

    const { sendMessage } = useSendMessage();
    await sendMessage("hello");

    expect(mocks.updateTitle).not.toHaveBeenCalled();
  });

  it("does not auto-rename when conversation already has messages", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [{ role: "user", content: "prev", images: [] }];
    store.conversations = [makeConv("conv-1", "New Chat")];

    vi.mocked(invoke).mockResolvedValue(undefined);

    const { sendMessage } = useSendMessage();
    await sendMessage("second message");

    expect(mocks.updateTitle).not.toHaveBeenCalled();
  });

  it("passes folder context string to invoke", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [makeConv("conv-1")];
    store.folderContexts["conv-1"] = [
      { path: "/a", content: "ctx1" } as never,
      { path: "/b", content: "ctx2" } as never,
    ];

    vi.mocked(invoke).mockResolvedValue(undefined);

    const { sendMessage } = useSendMessage();
    await sendMessage("hello");

    expect(vi.mocked(invoke)).toHaveBeenCalledWith(
      "send_message",
      expect.objectContaining({ folderContext: "ctx1\n\nctx2" }),
    );
  });

  it("passes null folder context when no contexts exist", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [makeConv("conv-1")];

    vi.mocked(invoke).mockResolvedValue(undefined);

    const { sendMessage } = useSendMessage();
    await sendMessage("hello");

    expect(vi.mocked(invoke)).toHaveBeenCalledWith(
      "send_message",
      expect.objectContaining({ folderContext: null }),
    );
  });

  it("forwards chatOptions to invoke when provided", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [makeConv("conv-1")];

    vi.mocked(invoke).mockResolvedValue(undefined);

    const options = {
      temperature: 0.1,
      top_p: 0.7,
      top_k: 20,
      num_ctx: 8192,
      repeat_penalty: 1.15,
      repeat_last_n: 64,
    };

    const { sendMessage } = useSendMessage();
    await sendMessage("hello", undefined, undefined, undefined, options);

    expect(vi.mocked(invoke)).toHaveBeenCalledWith(
      "send_message",
      expect.objectContaining({ chatOptions: options }),
    );
  });

  it("passes null chatOptions to invoke when not provided", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [makeConv("conv-1")];

    vi.mocked(invoke).mockResolvedValue(undefined);

    const { sendMessage } = useSendMessage();
    await sendMessage("hello");

    expect(vi.mocked(invoke)).toHaveBeenCalledWith(
      "send_message",
      expect.objectContaining({ chatOptions: null }),
    );
  });

  it("does not roll back when backend already appended an error message", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [makeConv("conv-1")];

    vi.mocked(invoke).mockImplementation(async () => {
      // Simulate backend emitting chat:error which triggers onError adding a message
      store.messages["conv-1"].push({
        role: "assistant",
        content: "Error from backend",
        images: [],
      });
      throw new Error("cloud auth");
    });

    const { sendMessage } = useSendMessage();
    // Should NOT throw — backend already handled error display
    await expect(sendMessage("hello")).resolves.toBeUndefined();

    // Both the optimistic user message and the backend error message remain
    expect(store.messages["conv-1"]).toHaveLength(2);
    expect(store.streaming.isStreaming).toBe(false);
  });
});

describe("useSendMessage — stopGeneration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.persistDraft.mockResolvedValue("conv-1");
    mocks.clearDraft.mockResolvedValue(undefined);
    mocks.updateTitle.mockResolvedValue(undefined);
  });

  it("calls stop_generation and clears isStreaming", async () => {
    const store = useChatStore();
    store.streaming.isStreaming = true;

    vi.mocked(invoke).mockResolvedValue(undefined);

    const { stopGeneration } = useSendMessage();
    await stopGeneration();

    expect(vi.mocked(invoke)).toHaveBeenCalledWith("stop_generation");
    expect(store.streaming.isStreaming).toBe(false);
  });

  it("clears isStreaming even when stop_generation fails", async () => {
    const store = useChatStore();
    store.streaming.isStreaming = true;

    vi.mocked(invoke).mockRejectedValue(new Error("stop failed"));

    const { stopGeneration } = useSendMessage();
    await stopGeneration(); // should not throw

    expect(store.streaming.isStreaming).toBe(false);
  });
});
