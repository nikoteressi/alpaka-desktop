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
});
