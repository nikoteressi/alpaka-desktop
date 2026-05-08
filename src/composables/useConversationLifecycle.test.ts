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

  it("createConversation throws when model is blank", async () => {
    const { createConversation } = useConversationLifecycle();
    await expect(createConversation("  ")).rejects.toThrow(
      "A model must be specified",
    );
    await expect(createConversation()).rejects.toThrow(
      "A model must be specified",
    );
  });

  it("createConversation invokes backend, prepends conv, and sets it active", async () => {
    const store = useChatStore();
    const newConv = {
      id: "new-1",
      model: "llama3",
      title: "New",
      settings_json: "{}",
      pinned: false,
      tags: [],
      draft_json: null,
      created_at: "",
      updated_at: "",
    };
    vi.mocked(invoke)
      .mockResolvedValueOnce(newConv)
      .mockResolvedValue(undefined);

    const { createConversation } = useConversationLifecycle();
    const id = await createConversation("llama3", "You are helpful.");

    expect(id).toBe("new-1");
    expect(store.conversations[0].id).toBe("new-1");
    expect(store.activeConversationId).toBe("new-1");
  });

  it("setPinned invokes backend and updates store when conv exists", async () => {
    const store = useChatStore();
    store.conversations = [
      {
        id: "conv-p",
        model: "llama3",
        title: "T",
        settings_json: "{}",
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
    ];
    vi.mocked(invoke).mockResolvedValue(undefined);

    const { setPinned } = useConversationLifecycle();
    await setPinned("conv-p", true);

    expect(invoke).toHaveBeenCalledWith("set_conversation_pinned", {
      conversationId: "conv-p",
      pinned: true,
    });
    expect(store.conversations[0].pinned).toBe(true);
  });

  it("setPinned still invokes backend when conv not in store", async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const { setPinned } = useConversationLifecycle();
    await setPinned("missing", false);
    expect(invoke).toHaveBeenCalledWith("set_conversation_pinned", {
      conversationId: "missing",
      pinned: false,
    });
  });

  it("updateSystemPrompt writes to draftSystemPrompt for draft conversations", async () => {
    const store = useChatStore();
    const { updateSystemPrompt } = useConversationLifecycle();
    await updateSystemPrompt("__draft__abc", "Be concise.");
    expect(store.draftSystemPrompt).toBe("Be concise.");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("updateSystemPrompt updates existing system message content in-place", async () => {
    const store = useChatStore();
    store.messages["conv-s"] = [
      {
        id: "m1",
        role: "system",
        content: "old",
        created_at: "",
        images: undefined,
        tokens_per_sec: undefined,
      },
    ];
    vi.mocked(invoke).mockResolvedValue(undefined);

    const { updateSystemPrompt } = useConversationLifecycle();
    await updateSystemPrompt("conv-s", "new prompt");

    expect(store.messages["conv-s"][0].content).toBe("new prompt");
  });

  it("updateSystemPrompt reloads conversation when system msg is absent and prompt is non-empty", async () => {
    const store = useChatStore();
    store.messages["conv-ns"] = [
      {
        id: "m2",
        role: "user",
        content: "hi",
        created_at: "",
        images: undefined,
        tokens_per_sec: undefined,
      },
    ];
    vi.mocked(invoke).mockResolvedValue([]);

    const { updateSystemPrompt } = useConversationLifecycle();
    await updateSystemPrompt("conv-ns", "new system");

    expect(invoke).toHaveBeenCalledWith("update_system_prompt", {
      conversationId: "conv-ns",
      systemPrompt: "new system",
    });
    expect(invoke).toHaveBeenCalledWith("get_messages", expect.anything());
  });

  it("updateTitle succeeds without rolling back when invoke resolves", async () => {
    const store = useChatStore();
    store.conversations = [
      {
        id: "conv-t",
        model: "llama3",
        title: "Original",
        settings_json: "{}",
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
    ];
    vi.mocked(invoke).mockResolvedValue(undefined);

    const { updateTitle } = useConversationLifecycle();
    await updateTitle("conv-t", "Updated");

    expect(store.conversations[0].title).toBe("Updated");
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
