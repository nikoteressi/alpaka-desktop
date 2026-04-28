import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { useConversationLifecycle } from "./useConversationLifecycle";
import { useChatStore } from "../stores/chat";

describe("useConversationLifecycle", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("updateTitle does optimistic update and rolls back on failure", async () => {
    const store = useChatStore();
    store.conversations = [
      {
        id: "conv-1",
        model: "llama3",
        title: "Old Title",
        settings_json: "{}",
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
    ];

    vi.mocked(invoke).mockRejectedValue(new Error("network"));

    const { updateTitle } = useConversationLifecycle();
    await expect(updateTitle("conv-1", "New Title")).rejects.toThrow();

    expect(store.conversations[0].title).toBe("Old Title");
  });

  it("deleteConversation removes from store and switches active", async () => {
    const store = useChatStore();
    store.conversations = [
      {
        id: "conv-1",
        model: "llama3",
        title: "A",
        settings_json: "{}",
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
      {
        id: "conv-2",
        model: "llama3",
        title: "B",
        settings_json: "{}",
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
    ];
    store.activeConversationId = "conv-1";
    store.messages["conv-1"] = [];
    vi.mocked(invoke).mockResolvedValue(undefined);

    const { deleteConversation } = useConversationLifecycle();
    await deleteConversation("conv-1");

    expect(store.conversations.find((c) => c.id === "conv-1")).toBeUndefined();
    expect(store.activeConversationId).toBe("conv-2");
  });
});
