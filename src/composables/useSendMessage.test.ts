import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { useSendMessage } from "./useSendMessage";
import { useChatStore } from "../stores/chat";

describe("useSendMessage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("optimistically adds user message before invoke", async () => {
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    store.conversations = [
      {
        id: "conv-1",
        model: "llama3",
        title: "Test",
        settings_json: "{}",
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
    ];

    // Make invoke hang so we can check state before resolution
    let resolveInvoke!: () => void;
    vi.mocked(invoke).mockReturnValue(
      new Promise((r) => {
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
    store.conversations = [
      {
        id: "conv-1",
        model: "llama3",
        title: "Test",
        settings_json: "{}",
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
    ];

    vi.mocked(invoke).mockRejectedValue(new Error("Network error"));

    const { sendMessage } = useSendMessage();
    await expect(sendMessage("hello")).rejects.toThrow(
      "Failed to send message",
    );

    expect(store.messages["conv-1"]).toHaveLength(0);
    expect(store.streaming.isStreaming).toBe(false);
  });
});
