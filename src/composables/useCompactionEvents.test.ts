import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

type EventHandler<T> = (event: { payload: T }) => void | Promise<void>;

const handlers: Record<string, EventHandler<unknown>> = {};
const unlistenFns: Record<string, ReturnType<typeof vi.fn>> = {};

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((eventName: string, handler: EventHandler<unknown>) => {
    handlers[eventName] = handler;
    unlistenFns[eventName] = vi.fn();
    return Promise.resolve(unlistenFns[eventName]);
  }),
}));

describe("useCompactionEvents", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    // reset module-level cleanup state between tests
    vi.resetModules();
  });

  it("init registers listeners for compact:token, compact:done, compact:error", async () => {
    const { listen } = await import("@tauri-apps/api/event");
    const { useCompactionEvents } = await import("./useCompactionEvents");
    const { useCompactionEvents: _ } = await import("./useCompactionEvents");
    void _;

    const { init } = useCompactionEvents();
    await init();

    expect(listen).toHaveBeenCalledWith("compact:token", expect.any(Function));
    expect(listen).toHaveBeenCalledWith("compact:done", expect.any(Function));
    expect(listen).toHaveBeenCalledWith("compact:error", expect.any(Function));
  });

  it("compact:token handler appends token to store", async () => {
    const { useCompactionEvents } = await import("./useCompactionEvents");
    const { useChatStore } = await import("../stores/chat");
    const store = useChatStore();

    const { init } = useCompactionEvents();
    await init();

    handlers["compact:token"]({
      payload: { conversation_id: "conv-1", content: "hello" },
    });
    handlers["compact:token"]({
      payload: { conversation_id: "conv-1", content: " world" },
    });

    expect(store.compactionTokens["conv-1"]).toBe("hello world");
  });

  it("compact:done handler finishes compaction and reloads active conversation", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue([]);

    const { useCompactionEvents } = await import("./useCompactionEvents");
    const { useChatStore } = await import("../stores/chat");
    const store = useChatStore();
    store.activeConversationId = "conv-1";
    store.compactionInProgress["conv-1"] = true;
    store.messages["conv-1"] = [{ role: "user", content: "old" } as never];

    const { init } = useCompactionEvents();
    await init();

    await handlers["compact:done"]({ payload: { conversation_id: "conv-1" } });

    expect(store.compactionInProgress["conv-1"]).toBeUndefined();
    // messages are cleared then reloaded (invoke returns [])
    expect(store.messages["conv-1"]).toEqual([]);
  });

  it("compact:done handler clears messages cache for non-active conversation", async () => {
    const { useCompactionEvents } = await import("./useCompactionEvents");
    const { useChatStore } = await import("../stores/chat");
    const store = useChatStore();
    store.activeConversationId = "conv-2"; // different from compacted conv
    store.compactionInProgress["conv-1"] = true;
    store.messages["conv-1"] = [{ role: "user", content: "old" } as never];

    const { init } = useCompactionEvents();
    await init();

    await handlers["compact:done"]({ payload: { conversation_id: "conv-1" } });

    expect(store.compactionInProgress["conv-1"]).toBeUndefined();
    // cache must be cleared so next navigation forces a fresh load
    expect(store.messages["conv-1"]).toBeUndefined();
  });

  it("compact:error handler finishes compaction", async () => {
    const { useCompactionEvents } = await import("./useCompactionEvents");
    const { useChatStore } = await import("../stores/chat");
    const store = useChatStore();
    store.compactionInProgress["conv-1"] = true;
    store.compactionTokens["conv-1"] = "partial";

    const { init } = useCompactionEvents();
    await init();

    handlers["compact:error"]({
      payload: { conversation_id: "conv-1", error: "boom" },
    });

    expect(store.compactionInProgress["conv-1"]).toBeUndefined();
    expect(store.compactionTokens["conv-1"]).toBeUndefined();
  });

  it("calling init a second time cleans up previous listeners first", async () => {
    const { useCompactionEvents } = await import("./useCompactionEvents");
    const { init } = useCompactionEvents();
    await init();

    const firstUnlisten = unlistenFns["compact:token"];
    expect(firstUnlisten).toBeDefined();

    await init();

    expect(firstUnlisten).toHaveBeenCalledOnce();
  });
});
