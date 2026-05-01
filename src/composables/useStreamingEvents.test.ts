import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useStreamingEvents } from "./useStreamingEvents";
import { useChatStore } from "../stores/chat";

// Capture listen() callbacks so tests can fire synthetic events.
type EventCallback = (event: { payload: unknown }) => void;
const eventHandlers: Record<string, EventCallback> = {};

const mockListen = vi
  .fn()
  .mockImplementation((eventName: string, cb: EventCallback) => {
    eventHandlers[eventName] = cb;
    return Promise.resolve(() => {});
  });

vi.mock("@tauri-apps/api/event", () => ({
  listen: (eventName: string, cb: EventCallback) => mockListen(eventName, cb),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(null),
}));

function fire(eventName: string, payload: unknown) {
  eventHandlers[eventName]?.({ payload });
}

describe("useStreamingEvents", () => {
  let chatStore: ReturnType<typeof useChatStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());
    chatStore = useChatStore();
    // Clear handler capture and reset init flag each test
    for (const key of Object.keys(eventHandlers)) {
      delete eventHandlers[key];
    }
    mockListen.mockClear();
    chatStore._listenersInitialized = false;
    chatStore.activeConversationId = "conv-1";
    chatStore.messages["conv-1"] = [];

    await useStreamingEvents().init();
  });

  // --- init ---

  it("registers all 8 event listeners on init", () => {
    const events = mockListen.mock.calls.map(([name]) => name);
    expect(events).toContain("chat:token");
    expect(events).toContain("chat:thinking-start");
    expect(events).toContain("chat:thinking-token");
    expect(events).toContain("chat:thinking-end");
    expect(events).toContain("chat:done");
    expect(events).toContain("chat:error");
    expect(events).toContain("chat:tool-call");
    expect(events).toContain("chat:tool-result");
  });

  it("does not register listeners a second time (idempotent)", async () => {
    const callsAfterFirst = mockListen.mock.calls.length;
    await useStreamingEvents().init();
    expect(mockListen.mock.calls.length).toBe(callsAfterFirst);
  });

  // --- onToken ---

  it("onToken appends content to buffer when not thinking", () => {
    fire("chat:token", {
      conversation_id: "conv-1",
      content: "hello",
      done: false,
    });
    expect(chatStore.streaming.buffer).toBe("hello");
  });

  it("onToken strips <think> and </think> tags from content", () => {
    fire("chat:token", {
      conversation_id: "conv-1",
      content: "pre<think>tag</think>post",
      done: false,
    });
    expect(chatStore.streaming.buffer).toContain("pretagpost");
  });

  it("onToken increments evalTokens when eval_tokens not in payload", () => {
    const before = chatStore.streaming.evalTokens;
    fire("chat:token", {
      conversation_id: "conv-1",
      content: "x",
      done: false,
    });
    expect(chatStore.streaming.evalTokens).toBe(before + 1);
  });

  it("onToken sets evalTokens from payload when eval_tokens present", () => {
    fire("chat:token", {
      conversation_id: "conv-1",
      content: "x",
      done: false,
      eval_tokens: 42,
    });
    expect(chatStore.streaming.evalTokens).toBe(42);
  });

  it("onToken sets promptTokens from payload", () => {
    fire("chat:token", {
      conversation_id: "conv-1",
      content: "x",
      done: false,
      prompt_tokens: 100,
    });
    expect(chatStore.streaming.promptTokens).toBe(100);
  });

  it("onToken appends to thinkingBuffer when isThinking is true", () => {
    chatStore.streaming.isThinking = true;
    fire("chat:token", {
      conversation_id: "conv-1",
      content: "thought",
      done: false,
    });
    expect(chatStore.streaming.thinkingBuffer).toBe("thought");
    expect(chatStore.streaming.buffer).toBe("");
  });

  // --- onThinkingStart ---

  it("onThinkingStart sets isThinking to true and clears thinkTime", () => {
    chatStore.streaming.thinkTime = 3;
    fire("chat:thinking-start", { conversation_id: "conv-1" });
    expect(chatStore.streaming.isThinking).toBe(true);
    expect(chatStore.streaming.thinkTime).toBeNull();
  });

  // --- onThinkingToken ---

  it("onThinkingToken appends to thinkingBuffer", () => {
    fire("chat:thinking-token", {
      conversation_id: "conv-1",
      content: "inner thought",
    });
    expect(chatStore.streaming.thinkingBuffer).toBe("inner thought");
  });

  it("onThinkingToken increments evalTokens when eval_tokens absent", () => {
    const before = chatStore.streaming.evalTokens;
    fire("chat:thinking-token", {
      conversation_id: "conv-1",
      content: "x",
    });
    expect(chatStore.streaming.evalTokens).toBe(before + 1);
  });

  it("onThinkingToken sets evalTokens from payload when present", () => {
    fire("chat:thinking-token", {
      conversation_id: "conv-1",
      content: "x",
      eval_tokens: 7,
    });
    expect(chatStore.streaming.evalTokens).toBe(7);
  });

  it("onThinkingToken sets promptTokens when present", () => {
    fire("chat:thinking-token", {
      conversation_id: "conv-1",
      content: "x",
      prompt_tokens: 50,
    });
    expect(chatStore.streaming.promptTokens).toBe(50);
  });

  // --- onThinkingEnd ---

  it("onThinkingEnd resets isThinking and folds thinkingBuffer into buffer", () => {
    chatStore.streaming.isThinking = true;
    chatStore.streaming.thinkingBuffer = "my reasoning";

    fire("chat:thinking-end", { conversation_id: "conv-1", duration_ms: 2000 });

    expect(chatStore.streaming.isThinking).toBe(false);
    expect(chatStore.streaming.thinkingBuffer).toBe("");
    expect(chatStore.streaming.buffer).toContain("my reasoning");
    expect(chatStore.streaming.buffer).toContain("<think");
  });

  it("onThinkingEnd includes formatted time attribute when duration_ms provided", () => {
    chatStore.streaming.thinkingBuffer = "inner";
    fire("chat:thinking-end", { conversation_id: "conv-1", duration_ms: 3500 });
    expect(chatStore.streaming.buffer).toContain("time=3.5");
  });

  it("onThinkingEnd omits time attribute when duration_ms is zero", () => {
    chatStore.streaming.thinkingBuffer = "inner";
    fire("chat:thinking-end", { conversation_id: "conv-1", duration_ms: 0 });
    expect(chatStore.streaming.buffer).toContain("<think>");
    expect(chatStore.streaming.buffer).not.toContain("time=");
  });

  // --- onDone ---

  it("onDone calls finalizeStreamedMessage with payload fields", () => {
    const spy = vi.spyOn(chatStore, "finalizeStreamedMessage");
    chatStore.streaming.buffer = "reply";

    fire("chat:done", {
      conversation_id: "conv-1",
      total_tokens: 100,
      prompt_tokens: 30,
      tokens_per_sec: 25.5,
      duration_ms: 1000,
      total_duration_ms: 1200,
      load_duration_ms: 50,
      prompt_eval_duration_ms: 200,
      eval_duration_ms: 750,
      seed: 42,
    });

    expect(spy).toHaveBeenCalledWith(
      "conv-1",
      100,
      30,
      25.5,
      1000,
      1200,
      50,
      200,
      750,
      42,
    );
  });

  it("onDone sets isStreaming to false", () => {
    chatStore.streaming.isStreaming = true;
    chatStore.streaming.buffer = "reply";

    fire("chat:done", {
      conversation_id: "conv-1",
      total_tokens: 10,
      prompt_tokens: 5,
      tokens_per_sec: 10,
      duration_ms: 500,
      total_duration_ms: 600,
      load_duration_ms: 20,
      prompt_eval_duration_ms: 80,
      eval_duration_ms: 400,
    });

    expect(chatStore.streaming.isStreaming).toBe(false);
  });

  it("onDone updates tokensPerSec", () => {
    chatStore.streaming.buffer = "reply";
    fire("chat:done", {
      conversation_id: "conv-1",
      total_tokens: 10,
      prompt_tokens: 5,
      tokens_per_sec: 99.9,
      duration_ms: 500,
      total_duration_ms: 600,
      load_duration_ms: 20,
      prompt_eval_duration_ms: 80,
      eval_duration_ms: 400,
    });
    expect(chatStore.streaming.tokensPerSec).toBe(99.9);
  });

  // --- onError ---

  it("onError with empty buffer sets an error message in buffer and finalizes", () => {
    chatStore.streaming.buffer = "";
    chatStore.messages["conv-1"] = [];

    fire("chat:error", {
      conversation_id: "conv-1",
      error: "connection refused",
    });

    expect(chatStore.streaming.buffer).toBe("");
    // After finalizeStreamedMessage the buffer is cleared; message is in messages[]
    expect(chatStore.messages["conv-1"]).toHaveLength(1);
    expect(chatStore.messages["conv-1"][0].content).toContain(
      "connection refused",
    );
  });

  it("onError with existing buffer appends error and finalizes", () => {
    chatStore.streaming.buffer = "partial response";
    chatStore.messages["conv-1"] = [];

    fire("chat:error", { conversation_id: "conv-1", error: "timeout" });

    const content = chatStore.messages["conv-1"][0].content;
    expect(content).toContain("partial response");
    expect(content).toContain("timeout");
  });

  it("onError sets isStreaming to false", () => {
    chatStore.streaming.isStreaming = true;
    fire("chat:error", { conversation_id: "conv-1", error: "oops" });
    expect(chatStore.streaming.isStreaming).toBe(false);
  });

  // --- onToolCall ---

  it("onToolCall pushes to toolCalls and appends tag to buffer", () => {
    fire("chat:tool-call", {
      conversation_id: "conv-1",
      tool_name: "web_search",
      query: "latest news",
    });

    expect(chatStore.streaming.toolCalls).toHaveLength(1);
    expect(chatStore.streaming.toolCalls[0].name).toBe("web_search");
    expect(chatStore.streaming.toolCalls[0].query).toBe("latest news");
    expect(chatStore.streaming.buffer).toContain(
      '<tool_call name="web_search" query="latest news">',
    );
  });

  // --- onToolResult ---

  it("onToolResult updates the matching toolCall entry and replaces the buffer tag", () => {
    // Seed state via tool-call event first
    fire("chat:tool-call", {
      conversation_id: "conv-1",
      tool_name: "web_search",
      query: "latest news",
    });

    fire("chat:tool-result", {
      conversation_id: "conv-1",
      tool_name: "web_search",
      query: "latest news",
      result: "top story: …",
    });

    const call = chatStore.streaming.toolCalls[0];
    expect(call.result).toBe("top story: …");
    expect(chatStore.streaming.buffer).toContain("top story: …");
    // The empty tag should be replaced
    expect(chatStore.streaming.buffer).not.toContain(
      '<tool_call name="web_search" query="latest news"></tool_call>',
    );
  });
});
