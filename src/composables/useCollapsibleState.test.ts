import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("useCollapsibleState", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.resetModules();
  });

  it("defaults to closed (initialOpen=false)", async () => {
    const { useCollapsibleState } = await import("./useCollapsibleState");
    const { isOpen } = useCollapsibleState();
    expect(isOpen.value).toBe(false);
  });

  it("respects initialOpen=true when no cache key exists", async () => {
    const { useCollapsibleState } = await import("./useCollapsibleState");
    const { isOpen } = useCollapsibleState({ initialOpen: true });
    expect(isOpen.value).toBe(true);
  });

  it("toggle flips isOpen", async () => {
    const { useCollapsibleState } = await import("./useCollapsibleState");
    const { isOpen, toggle } = useCollapsibleState();
    expect(isOpen.value).toBe(false);
    toggle();
    expect(isOpen.value).toBe(true);
    toggle();
    expect(isOpen.value).toBe(false);
  });

  it("setOpen sets isOpen to specified value", async () => {
    const { useCollapsibleState } = await import("./useCollapsibleState");
    const { isOpen, setOpen } = useCollapsibleState();
    setOpen(true);
    expect(isOpen.value).toBe(true);
    setOpen(false);
    expect(isOpen.value).toBe(false);
  });

  it("persists state to cache keyed by conversationId+messageKey when chat store has an active conversation", async () => {
    const { useChatStore } = await import("../stores/chat");
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-1";

    const { useCollapsibleState } = await import("./useCollapsibleState");

    const { isOpen: a, toggle } = useCollapsibleState({ messageKey: "msg-1" });
    expect(a.value).toBe(false);
    toggle();
    expect(a.value).toBe(true);

    // A second instance with the same key should read from cache
    const { isOpen: b } = useCollapsibleState({ messageKey: "msg-1" });
    expect(b.value).toBe(true);
  });

  it("uses suffix in cache key to prevent collisions", async () => {
    const { useChatStore } = await import("../stores/chat");
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-2";

    const { useCollapsibleState } = await import("./useCollapsibleState");

    const { toggle: toggleA } = useCollapsibleState({
      messageKey: "msg-2",
      suffix: "think",
    });
    toggleA();

    const { isOpen: withSuffix } = useCollapsibleState({
      messageKey: "msg-2",
      suffix: "think",
    });
    const { isOpen: withoutSuffix } = useCollapsibleState({
      messageKey: "msg-2",
    });

    expect(withSuffix.value).toBe(true);
    expect(withoutSuffix.value).toBe(false);
  });

  it("does not cache when messageKey is the streaming sentinel", async () => {
    const { useChatStore } = await import("../stores/chat");
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-3";

    const { useCollapsibleState } = await import("./useCollapsibleState");
    const { isOpen, toggle } = useCollapsibleState({
      messageKey: "msg-streaming-active",
    });
    toggle();
    expect(isOpen.value).toBe(true);

    const { isOpen: fresh } = useCollapsibleState({
      messageKey: "msg-streaming-active",
    });
    expect(fresh.value).toBe(false);
  });

  it("does not cache when no active conversation", async () => {
    const { useChatStore } = await import("../stores/chat");
    const chatStore = useChatStore();
    chatStore.activeConversationId = null;

    const { useCollapsibleState } = await import("./useCollapsibleState");
    const { isOpen, toggle } = useCollapsibleState({ messageKey: "msg-x" });
    toggle();
    expect(isOpen.value).toBe(true);

    const { isOpen: fresh } = useCollapsibleState({ messageKey: "msg-x" });
    expect(fresh.value).toBe(false);
  });
});
