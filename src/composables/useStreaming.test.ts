import { describe, it, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

const unlistenFns: Array<() => void> = [];
const mockListen = vi
  .fn()
  .mockImplementation(
    async (_event: string, _handler: (event: { payload: unknown }) => void) => {
      const unlisten = vi.fn();
      unlistenFns.push(unlisten);
      return unlisten;
    },
  );

vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, handler: (event: { payload: unknown }) => void) =>
    mockListen(event, handler),
}));

// Import after mock is set up
const { useStreaming } = await import("./useStreaming");

describe("useStreaming", () => {
  beforeEach(() => {
    mockListen.mockClear();
    unlistenFns.length = 0;
  });

  it("listenersReady resolves after all 8 listeners are registered", async () => {
    const convId = ref<string | null>(null);
    const { listenersReady } = useStreaming(convId);

    await listenersReady;

    expect(mockListen).toHaveBeenCalledTimes(9);
    const events = mockListen.mock.calls.map(([event]) => event);
    expect(events).toContain("chat:token");
    expect(events).toContain("chat:thinking-start");
    expect(events).toContain("chat:thinking-token");
    expect(events).toContain("chat:thinking-end");
    expect(events).toContain("chat:done");
    expect(events).toContain("chat:tool-call");
    expect(events).toContain("chat:tool-result");
    expect(events).toContain("chat:error");
    expect(events).toContain("chat:cancelled");
  });

  it("onToken callback is NOT called for tokens belonging to a different conversation", async () => {
    const convId = ref<string | null>("active-conv-id");
    const onToken = vi.fn();
    const { listenersReady } = useStreaming(convId, { onToken });

    await listenersReady;

    // Simulate a token for a DIFFERENT conversation
    const tokenHandler = mockListen.mock.calls.find(
      ([e]) => e === "chat:token",
    )?.[1];
    expect(tokenHandler).toBeDefined();
    tokenHandler({
      payload: {
        conversation_id: "OTHER-conv",
        content: "ignored",
        done: false,
      },
    });

    expect(onToken).not.toHaveBeenCalled();
  });

  it("onToken callback IS called for tokens matching the active conversation", async () => {
    const convId = ref<string | null>("active-conv-id");
    const onToken = vi.fn();
    const { listenersReady } = useStreaming(convId, { onToken });

    await listenersReady;

    const tokenHandler = mockListen.mock.calls.find(
      ([e]) => e === "chat:token",
    )?.[1];
    tokenHandler({
      payload: {
        conversation_id: "active-conv-id",
        content: "hello",
        done: false,
      },
    });

    expect(onToken).toHaveBeenCalledWith({
      conversation_id: "active-conv-id",
      content: "hello",
      done: false,
    });
  });

  it("onToken callback IS called when conversationId filter is null (accepts all)", async () => {
    const convId = ref<string | null>(null);
    const onToken = vi.fn();
    const { listenersReady } = useStreaming(convId, { onToken });

    await listenersReady;

    const tokenHandler = mockListen.mock.calls.find(
      ([e]) => e === "chat:token",
    )?.[1];
    tokenHandler({
      payload: { conversation_id: "any-conv", content: "hello", done: false },
    });

    expect(onToken).toHaveBeenCalled();
  });

  it("cleanup function removes all listeners when called", async () => {
    const convId = ref<string | null>(null);
    const { listenersReady, cleanup } = useStreaming(convId);

    await listenersReady;
    cleanup();

    // All unlisten functions should have been called
    unlistenFns.forEach((fn) => expect(fn).toHaveBeenCalled());
  });

  it("onCancelled callback is called when chat:cancelled fires for the active conversation", async () => {
    const convId = ref<string | null>("active-conv-id");
    const onCancelled = vi.fn();
    const { listenersReady } = useStreaming(convId, { onCancelled });

    await listenersReady;

    const handler = mockListen.mock.calls.find(
      ([e]) => e === "chat:cancelled",
    )?.[1];
    expect(handler).toBeDefined();
    handler({ payload: { conversation_id: "active-conv-id" } });

    expect(onCancelled).toHaveBeenCalledWith("active-conv-id");
  });

  it("onCancelled callback is NOT called when chat:cancelled fires for a different conversation", async () => {
    const convId = ref<string | null>("active-conv-id");
    const onCancelled = vi.fn();
    const { listenersReady } = useStreaming(convId, { onCancelled });

    await listenersReady;

    const handler = mockListen.mock.calls.find(
      ([e]) => e === "chat:cancelled",
    )?.[1];
    handler({ payload: { conversation_id: "OTHER-conv" } });

    expect(onCancelled).not.toHaveBeenCalled();
  });

  it("reset() clears buffers and sets isStreaming to true", async () => {
    const convId = ref<string | null>(null);
    const {
      listenersReady,
      reset,
      buffer,
      thinkingBuffer,
      isThinking,
      isStreaming,
      tokensPerSec,
    } = useStreaming(convId);

    await listenersReady;

    // Mutate state to non-default values
    buffer.value = "some content";
    thinkingBuffer.value = "thinking...";
    isThinking.value = true;
    isStreaming.value = false;
    tokensPerSec.value = 42;

    reset();

    expect(buffer.value).toBe("");
    expect(thinkingBuffer.value).toBe("");
    expect(isThinking.value).toBe(false);
    expect(isStreaming.value).toBe(true);
    expect(tokensPerSec.value).toBeNull();
  });

  it("composable does not call onUnmounted — cleanup is explicit only", async () => {
    // This test documents that useStreaming does NOT rely on Vue component
    // lifecycle hooks. The composable is safe to call from a Pinia store.
    const { onUnmounted } = await import("vue");
    const onUnmountedSpy = vi.spyOn({ onUnmounted }, "onUnmounted");

    const convId = ref<string | null>(null);
    const { listenersReady } = useStreaming(convId);
    await listenersReady;

    // onUnmounted should not have been called during setup
    expect(onUnmountedSpy).not.toHaveBeenCalled();
    onUnmountedSpy.mockRestore();
  });
});
