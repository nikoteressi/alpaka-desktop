import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useChatStore } from "./chat";
import type { Conversation } from "../types/chat";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => mockInvoke(cmd, args),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const CONV_ID = "conv-1";
const CONV = {
  id: CONV_ID,
  title: "Chat",
  model: "llama3:latest",
  settings_json: "{}",
  pinned: false,
  tags: [],
  draft_json: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as unknown as Conversation;

const backendMsg = (id: string, content: string) => ({
  id,
  conversation_id: CONV_ID,
  role: "assistant",
  content,
  created_at: "2026-01-01T00:00:00Z",
});

function setup() {
  const store = useChatStore();
  store.conversations = [CONV];
  store.activeConversationId = CONV_ID;
  store.messages[CONV_ID] = [{ id: "old", role: "assistant", content: "old" }];
  return store;
}

describe("chat store: version navigation and regeneration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue([]);
  });

  it("switchVersion activates the sibling and reloads the conversation", async () => {
    const store = setup();
    mockInvoke.mockImplementation((cmd: string) =>
      Promise.resolve(
        cmd === "get_messages" ? [backendMsg("new", "fresh")] : [],
      ),
    );
    await store.switchVersion("sib-2");
    expect(mockInvoke).toHaveBeenCalledWith("switch_version", {
      siblingId: "sib-2",
    });
    expect(store.messages[CONV_ID]?.map((m) => m.content)).toEqual(["fresh"]);
  });

  it("navigateVersion moves in the given direction and reloads", async () => {
    const store = setup();
    await store.navigateVersion("m1", -1);
    expect(mockInvoke).toHaveBeenCalledWith("navigate_version", {
      messageId: "m1",
      direction: -1,
    });
    expect(mockInvoke).toHaveBeenCalledWith(
      "get_messages",
      expect.objectContaining({ conversationId: CONV_ID }),
    );
  });

  it("version switches without an active conversation skip the reload", async () => {
    const store = useChatStore();
    await store.switchVersion("sib");
    await store.navigateVersion("m1", 1);
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "get_messages",
      expect.anything(),
    );
  });

  it("refreshMessages replaces messages only for the active conversation", async () => {
    const store = setup();
    mockInvoke.mockResolvedValue([backendMsg("r1", "refreshed")]);
    await store.refreshMessages(CONV_ID);
    expect(store.messages[CONV_ID]?.[0]?.content).toBe("refreshed");

    await store.refreshMessages("other-conv");
    expect(store.messages["other-conv"]).toBeUndefined();
  });

  it("refreshMessages tolerates backend errors", async () => {
    const store = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockInvoke.mockRejectedValue(new Error("db down"));
    await expect(store.refreshMessages(CONV_ID)).resolves.toBeUndefined();
    expect(store.messages[CONV_ID]?.[0]?.content).toBe("old");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("clearMessages drops the cached messages", () => {
    const store = setup();
    store.clearMessages(CONV_ID);
    expect(store.messages[CONV_ID]).toBeUndefined();
  });

  it("regenerateMessage sets up streaming and calls the backend", async () => {
    const store = setup();
    mockInvoke.mockResolvedValue(undefined);
    await store.regenerateMessage("parent-1");
    expect(mockInvoke).toHaveBeenCalledWith("regenerate_message", {
      conversationId: CONV_ID,
      parentMessageId: "parent-1",
      model: "llama3:latest",
      thinkMode: null,
      chatOptions: null,
      webSearchEnabled: false,
    });
    expect(store.streaming.isStreaming).toBe(true);
    expect(store.streaming.currentConversationId).toBe(CONV_ID);
    expect(store.streaming.regeneratingMessageId).toBeNull();
  });

  it("regenerateMessage resets streaming state when the backend fails", async () => {
    const store = setup();
    mockInvoke.mockRejectedValue(new Error("boom"));
    await expect(store.regenerateMessage("parent-1")).rejects.toThrow("boom");
    expect(store.streaming.isStreaming).toBe(false);
    expect(store.streaming.regeneratingMessageId).toBeNull();
  });

  it("regenerateMessage does nothing without an active, known conversation", async () => {
    const store = useChatStore();
    await store.regenerateMessage("p");
    store.activeConversationId = "missing";
    await store.regenerateMessage("p");
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(store.streaming.isStreaming).toBe(false);
  });
});
