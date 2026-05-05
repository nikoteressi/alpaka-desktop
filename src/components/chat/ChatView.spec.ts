import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import ChatView from "./ChatView.vue";
import { useChatStore } from "../../stores/chat";
import { useModelStore } from "../../stores/models";
import { useSettingsStore } from "../../stores/settings";

// ---- Module-level mocks ----

const mockInvoke = vi.fn().mockResolvedValue([]);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn(),
}));

// Stable spy objects captured at module level so every call to useAppOrchestration()
// returns the same spy references — otherwise re-importing inside a test gets a new
// object and the assertion sees 0 calls.
const mockStartNewChat = vi.fn();
const mockSwitchHost = vi.fn();

// Composable mocks — these reach into Tauri IPC and other stores transitively.
// Stub the modules so ChatView.vue mounts without side effects.
vi.mock("../../composables/useAppOrchestration", () => ({
  useAppOrchestration: () => ({
    startNewChat: mockStartNewChat,
    switchHost: mockSwitchHost,
  }),
}));

const mockSendMessage = vi.fn().mockResolvedValue(undefined);
const mockStopGeneration = vi.fn().mockResolvedValue(undefined);

vi.mock("../../composables/useSendMessage", () => ({
  useSendMessage: () => ({
    sendMessage: mockSendMessage,
    stopGeneration: mockStopGeneration,
  }),
}));

// ChatInput pulls in plugin-dialog, drag/drop events, etc. — irrelevant to ChatView tests.
vi.mock("./ChatInput.vue", () => ({
  default: {
    name: "ChatInput",
    template: '<div data-testid="chat-input-stub" />',
    props: ["isStreaming"],
    emits: ["send", "stop"],
  },
}));

// DynamicScroller / DynamicScrollerItem from vue-virtual-scroller won't work in happy-dom.
// The stub passes the slot so child content (MessageBubble) is still rendered.
vi.mock("vue-virtual-scroller", () => ({
  DynamicScroller: {
    name: "DynamicScroller",
    props: ["items", "minItemSize", "itemClass", "keyField"],
    template: `
      <div class="dynamic-scroller-stub">
        <slot v-for="(item, index) in items" :item="item" :index="index" :active="true" />
      </div>
    `,
  },
  DynamicScrollerItem: {
    name: "DynamicScrollerItem",
    props: ["item", "active", "sizeDependencies", "dataIndex"],
    template: "<div><slot /></div>",
  },
}));

// Stub MessageBubble — we only care that it is/isn't rendered, not its internals.
vi.mock("./MessageBubble.vue", () => ({
  default: {
    name: "MessageBubble",
    template: '<div data-testid="message-bubble-stub" />',
    props: [
      "message",
      "messageId",
      "isStreaming",
      "thinkingContent",
      "isThinking",
      "tokensPerSec",
    ],
  },
}));

// Stub the llama logo import so happy-dom won't complain about binary assets.
vi.mock("../../assets/llama-main.png", () => ({ default: "llama-main.png" }));

// ---- Helpers ----

function makeConversation(id = "conv-1", model = "llama3") {
  return {
    id,
    title: "Test Chat",
    model,
    settings_json: "{}",
    pinned: false,
    tags: [] as string[],
    draft_json: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeMessage(
  id: string,
  role: "user" | "assistant" | "system",
  content: string,
  extra: object = {},
) {
  return {
    id,
    conversation_id: "conv-1",
    role,
    content,
    tokens: 10,
    tokens_per_sec: undefined,
    prompt_tokens: undefined,
    generation_time_ms: 0,
    total_duration_ms: 0,
    load_duration_ms: 0,
    prompt_eval_duration_ms: 0,
    eval_duration_ms: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

function mountChatView() {
  const wrapper = mount(ChatView, {
    attachTo: document.body,
  });
  // Immediately mock scrollTo on the scroll container so that any scrollToBottom call
  // (onMounted, watchers, user actions) doesn't trigger happy-dom's scrollTop setter,
  // which is read-only when scroll properties have been overridden with getter descriptors.
  const scrollEl = wrapper.find(".overflow-y-auto").element as HTMLElement;
  vi.spyOn(scrollEl, "scrollTo").mockImplementation(() => {});
  return wrapper;
}

// ---- Tests ----

describe("ChatView.vue", () => {
  let chatStore: ReturnType<typeof useChatStore>;
  let modelStore: ReturnType<typeof useModelStore>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStartNewChat.mockClear();
    mockSwitchHost.mockClear();
    setActivePinia(createPinia());
    chatStore = useChatStore();
    modelStore = useModelStore();

    // Default: one loaded conversation, active.
    chatStore.conversations = [makeConversation()];
    chatStore.activeConversationId = "conv-1";
    chatStore.messages["conv-1"] = [];

    // Stub actions so onMounted side effects don't hit IPC.
    chatStore.loadConversations = vi.fn().mockResolvedValue(undefined);
    chatStore.loadConversation = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Drain pending timers BEFORE restoring mocks. The 500ms smooth-scroll guard timer
    // calls onScroll() which may call scrollToBottom('auto'), which calls el.scrollTo().
    // If we restore mocks first, the scrollTo spy is gone and happy-dom's real scrollTo
    // runs, trying to set scrollTop — which throws when a getter-only descriptor is installed.
    vi.runAllTimers();
    await nextTick();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ------------------------------------------------------------------ mount

  it("renders without crashing with empty messages", async () => {
    const wrapper = mountChatView();
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it("calls loadConversations on mount", async () => {
    mountChatView();
    await flushPromises();
    expect(chatStore.loadConversations).toHaveBeenCalledOnce();
  });

  it("calls startNewChat when no conversations exist and no activeConversationId", async () => {
    chatStore.conversations = [];
    chatStore.activeConversationId = null;

    mountChatView();
    await flushPromises();
    expect(mockStartNewChat).toHaveBeenCalledOnce();
  });

  it("calls loadConversation(conversations[0].id) when conversations exist but none is active", async () => {
    chatStore.activeConversationId = null;
    mountChatView();
    await flushPromises();
    expect(chatStore.loadConversation).toHaveBeenCalledWith("conv-1");
  });

  // ------------------------------------------------------------------ empty state / message list

  it("shows empty-state image when nonSystemMessages is empty", async () => {
    chatStore.messages["conv-1"] = [];
    const wrapper = mountChatView();
    await flushPromises();
    const img = wrapper.find("img[alt='Ollama']");
    expect(img.exists()).toBe(true);
  });

  it("hides empty-state when non-system messages exist", async () => {
    chatStore.messages["conv-1"] = [makeMessage("msg-u", "user", "Hello")];
    const wrapper = mountChatView();
    await flushPromises();
    const img = wrapper.find("img[alt='Ollama']");
    expect(img.exists()).toBe(false);
  });

  it("does not show empty-state when only a system message is present (nonSystemMessages is empty)", async () => {
    chatStore.messages["conv-1"] = [
      makeMessage("msg-s", "system", "You are a helpful assistant"),
    ];
    const wrapper = mountChatView();
    await flushPromises();
    // system message is filtered out — nonSystemMessages is still empty → shows empty state
    const img = wrapper.find("img[alt='Ollama']");
    expect(img.exists()).toBe(true);
  });

  it("renders MessageBubble stubs for each non-system message", async () => {
    chatStore.messages["conv-1"] = [
      makeMessage("msg-u", "user", "Hello"),
      makeMessage("msg-a", "assistant", "World"),
    ];
    const wrapper = mountChatView();
    await flushPromises();
    const bubbles = wrapper.findAll('[data-testid="message-bubble-stub"]');
    expect(bubbles).toHaveLength(2);
  });

  // ------------------------------------------------------------------ system prompt header

  it("hides system-prompt header when activeSystemPrompt is empty", async () => {
    chatStore.messages["conv-1"] = [];
    // No system message → activeSystemPrompt is ""
    const wrapper = mountChatView();
    await flushPromises();
    expect(wrapper.text()).not.toContain("System Instructions");
  });

  it("shows system-prompt header when activeSystemPrompt is non-empty", async () => {
    chatStore.messages["conv-1"] = [
      makeMessage("msg-s", "system", "Be concise."),
    ];
    const wrapper = mountChatView();
    await flushPromises();
    expect(wrapper.text()).toContain("System Instructions");
  });

  it("starts with system-prompt panel collapsed (isSystemPromptExpanded = false)", async () => {
    chatStore.messages["conv-1"] = [
      makeMessage("msg-s", "system", "Be concise."),
    ];
    const wrapper = mountChatView();
    await flushPromises();
    // Expanded body only exists when isSystemPromptExpanded is true
    const body = wrapper.find('div.px-4.pb-4');
    expect(body.exists()).toBe(false);
  });

  it("expands system-prompt panel when the header button is clicked", async () => {
    chatStore.messages["conv-1"] = [
      makeMessage("msg-s", "system", "Be concise."),
    ];
    const wrapper = mountChatView();
    await flushPromises();

    const button = wrapper.find("button.w-full.flex");
    await button.trigger("click");
    await nextTick();

    // The full system prompt text should now be visible
    expect(wrapper.text()).toContain("Be concise.");
  });

  it("collapses system-prompt panel on a second click", async () => {
    chatStore.messages["conv-1"] = [
      makeMessage("msg-s", "system", "Be concise."),
    ];
    const wrapper = mountChatView();
    await flushPromises();

    const button = wrapper.find("button.w-full.flex");
    await button.trigger("click"); // expand
    await nextTick();
    await button.trigger("click"); // collapse
    await nextTick();

    const body = wrapper.find('div.px-4.pb-4');
    expect(body.exists()).toBe(false);
  });

  // ------------------------------------------------------------------ streaming item injection

  it("injects streaming item into the scroller while streaming for active conversation", async () => {
    chatStore.messages["conv-1"] = [makeMessage("msg-u", "user", "Hi")];
    chatStore.streaming = {
      isStreaming: true,
      currentConversationId: "conv-1",
      buffer: "partial response",
      thinkingBuffer: "",
      isThinking: false,
      tokensPerSec: null,
      thinkTime: null,
      toolCalls: [],
      promptTokens: 0,
      evalTokens: 0,
    };

    const wrapper = mountChatView();
    await flushPromises();

    // With streaming active, itemsForScroller has: 1 past message + 1 streaming item
    // Both render as MessageBubble stubs
    const bubbles = wrapper.findAll('[data-testid="message-bubble-stub"]');
    expect(bubbles).toHaveLength(2);
  });

  it("does not inject streaming item when streaming is for a different conversation", async () => {
    chatStore.messages["conv-1"] = [makeMessage("msg-u", "user", "Hi")];
    chatStore.streaming = {
      isStreaming: true,
      currentConversationId: "conv-other",
      buffer: "other response",
      thinkingBuffer: "",
      isThinking: false,
      tokensPerSec: null,
      thinkTime: null,
      toolCalls: [],
      promptTokens: 0,
      evalTokens: 0,
    };

    const wrapper = mountChatView();
    await flushPromises();

    const bubbles = wrapper.findAll('[data-testid="message-bubble-stub"]');
    expect(bubbles).toHaveLength(1); // Only the past message, no streaming item
  });

  // ------------------------------------------------------------------ pull-progress banner

  it("shows pull-progress banner when the current model is being downloaded", async () => {
    chatStore.conversations = [makeConversation("conv-1", "llama3")];
    chatStore.activeConversationId = "conv-1";
    modelStore.pulling["llama3"] = {
      model: "llama3",
      status: "pulling manifest",
      percent: 42,
    };

    const wrapper = mountChatView();
    await flushPromises();

    expect(wrapper.text()).toContain("Downloading llama3");
    expect(wrapper.text()).toContain("42%");
  });

  it("hides pull-progress banner when no model is being downloaded", async () => {
    const wrapper = mountChatView();
    await flushPromises();
    expect(wrapper.text()).not.toContain("Downloading");
  });

  it("hides pull-progress banner when activeConversation has no model", async () => {
    chatStore.conversations = [makeConversation("conv-1", "")];
    chatStore.activeConversationId = "conv-1";
    modelStore.pulling["llama3"] = {
      model: "llama3",
      status: "pulling",
      percent: 10,
    };

    const wrapper = mountChatView();
    await flushPromises();
    expect(wrapper.text()).not.toContain("Downloading");
  });

  // ------------------------------------------------------------------ scroll-to-bottom button

  it("hides the jump-to-bottom button when isAutoScrollEnabled is true (default)", async () => {
    chatStore.messages["conv-1"] = [makeMessage("msg-u", "user", "Hello")];
    const wrapper = mountChatView();
    await flushPromises();

    const btn = wrapper.find("button.absolute.bottom-28");
    expect(btn.exists()).toBe(false);
  });

  it("shows jump-to-bottom button when user scrolls up (isAutoScrollEnabled = false)", async () => {
    chatStore.messages["conv-1"] = [makeMessage("msg-u", "user", "Hello")];
    const wrapper = mountChatView();
    await flushPromises();

    const scrollEl = wrapper.find(".overflow-y-auto").element as HTMLElement;

    // happy-dom marks scrollHeight/scrollTop/clientHeight as non-writable on real elements.
    // Provide getter+setter pairs so that happy-dom's internal scrollTo polyfill can still
    // write scrollTop without throwing (it would throw on a getter-only descriptor).
    let _scrollTop = 0;
    Object.defineProperty(scrollEl, "scrollHeight", {
      get: () => 1000,
      set: () => {},
      configurable: true,
    });
    Object.defineProperty(scrollEl, "scrollTop", {
      get: () => _scrollTop,
      set: (v: number) => { _scrollTop = v; },
      configurable: true,
    });
    Object.defineProperty(scrollEl, "clientHeight", {
      get: () => 600,
      set: () => {},
      configurable: true,
    });

    // _scrollTop is 0 → distanceToBottom = 1000 - 0 - 600 = 400 > 100
    await wrapper.find(".overflow-y-auto").trigger("scroll");
    await nextTick();

    const btn = wrapper.find("button.absolute.bottom-28");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("Jump to present");
  });

  it("restores isAutoScrollEnabled when user is near bottom", async () => {
    chatStore.messages["conv-1"] = [makeMessage("msg-u", "user", "Hello")];
    const wrapper = mountChatView();
    await flushPromises();

    const scrollEl = wrapper.find(".overflow-y-auto").element as HTMLElement;

    let _scrollTop = 0;
    Object.defineProperty(scrollEl, "scrollHeight", {
      get: () => 1000,
      set: () => {},
      configurable: true,
    });
    Object.defineProperty(scrollEl, "scrollTop", {
      get: () => _scrollTop,
      set: (v: number) => { _scrollTop = v; },
      configurable: true,
    });
    Object.defineProperty(scrollEl, "clientHeight", {
      get: () => 600,
      set: () => {},
      configurable: true,
    });

    // First: scroll far from bottom (distanceToBottom = 400 > 100) → disables auto-scroll
    _scrollTop = 0;
    await wrapper.find(".overflow-y-auto").trigger("scroll");
    await nextTick();

    // Then: scroll near the bottom (distanceToBottom = 1000 - 895 - 600 = -495 ≤ 100)
    _scrollTop = 895;
    await wrapper.find(".overflow-y-auto").trigger("scroll");
    await nextTick();

    const btn = wrapper.find("button.absolute.bottom-28");
    expect(btn.exists()).toBe(false);
  });

  // ------------------------------------------------------------------ watchers

  it("resets isSystemPromptExpanded when activeConversationId changes", async () => {
    chatStore.messages["conv-1"] = [makeMessage("msg-s", "system", "Be concise.")];
    const wrapper = mountChatView();
    await flushPromises();

    // Expand the system prompt
    const button = wrapper.find("button.w-full.flex");
    await button.trigger("click");
    await nextTick();
    expect(wrapper.find("div.px-4.pb-4").exists()).toBe(true);

    // Switch to a different conversation
    chatStore.conversations.push(makeConversation("conv-2", "llama3"));
    chatStore.messages["conv-2"] = [];
    chatStore.activeConversationId = "conv-2";
    await nextTick();

    // Panel should collapse
    expect(wrapper.find("div.px-4.pb-4").exists()).toBe(false);
  });

  it("auto-scrolls when itemsForScroller changes and isAutoScrollEnabled is true", async () => {
    chatStore.messages["conv-1"] = [];
    const wrapper = mountChatView();
    await flushPromises();

    const scrollEl = wrapper.find(".overflow-y-auto").element as HTMLElement;
    // Mock scrollTo before triggering the watcher — prevents happy-dom from writing scrollTop.
    const scrollToSpy = vi.spyOn(scrollEl, "scrollTo").mockImplementation(() => {});

    // Add a new message — this triggers the itemsForScroller watcher (flush: 'post').
    // The watcher calls scrollToBottom('auto'), which uses nextTick + rAF (no timer).
    chatStore.messages["conv-1"] = [makeMessage("msg-u", "user", "Hello")];
    await nextTick();
    await flushPromises();
    await nextTick();

    expect(scrollToSpy).toHaveBeenCalled();
  });

  // ------------------------------------------------------------------ contextBoundaryIndex / boundary divider

  it("injects a context-boundary divider when messages exceed the context window", async () => {
    const settingsStore = useSettingsStore();
    // Set a tiny context window so the boundary fires quickly.
    // contextBoundaryIndex only injects when boundaryIdx > 0. With 3 messages (tokens=8 each)
    // and num_ctx=10: newest-first idx=2 (acc=8), idx=1 (acc=16>=10) → boundary at index 1 > 0.
    settingsStore.chatOptions = { ...settingsStore.chatOptions, num_ctx: 10 };

    chatStore.messages["conv-1"] = [
      makeMessage("msg-u", "user", "First", { tokens: 8 }),
      makeMessage("msg-a", "assistant", "Second", { tokens: 8 }),
      makeMessage("msg-u", "user", "Third", { tokens: 8 }),
    ];

    const wrapper = mountChatView();
    await flushPromises();

    // The boundary divider renders a distinctive label
    expect(wrapper.text()).toContain("Outside context window");
  });

  // ------------------------------------------------------------------ isScrollerItem / isBoundaryItem type guards

  it("renders only MessageBubble for scroll items, not boundary items", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.chatOptions = { ...settingsStore.chatOptions, num_ctx: 10 };

    chatStore.messages["conv-1"] = [
      makeMessage("msg-u", "user", "First", { tokens: 8 }),
      makeMessage("msg-a", "assistant", "Second", { tokens: 8 }),
      makeMessage("msg-u", "user", "Third", { tokens: 8 }),
    ];

    const wrapper = mountChatView();
    await flushPromises();

    // 3 MessageBubble stubs for the 3 real messages; the boundary is a plain div, not a bubble
    const bubbles = wrapper.findAll('[data-testid="message-bubble-stub"]');
    expect(bubbles).toHaveLength(3);
    expect(wrapper.text()).toContain("Outside context window");
  });

  // ------------------------------------------------------------------ scrollToBottom button click

  it("clicking the jump-to-bottom button calls scrollTo and hides the button", async () => {
    chatStore.messages["conv-1"] = [makeMessage("msg-u", "user", "Hello")];
    const wrapper = mountChatView();
    await flushPromises();

    const scrollEl = wrapper.find(".overflow-y-auto").element as HTMLElement;

    // Mock scrollTo first — this prevents happy-dom from trying to set scrollTop (read-only)
    // when scrollToBottom's rAF fires after the button click.
    const scrollToSpy = vi.spyOn(scrollEl, "scrollTo").mockImplementation(() => {});

    // Scroll up to make button visible (distanceToBottom = 400 > 100).
    // Provide getter+setter pairs so happy-dom's scrollTo polyfill can write scrollTop.
    let _scrollTop = 0;
    Object.defineProperty(scrollEl, "scrollHeight", {
      get: () => 1000,
      set: () => {},
      configurable: true,
    });
    Object.defineProperty(scrollEl, "scrollTop", {
      get: () => _scrollTop,
      set: (v: number) => { _scrollTop = v; },
      configurable: true,
    });
    Object.defineProperty(scrollEl, "clientHeight", {
      get: () => 600,
      set: () => {},
      configurable: true,
    });
    await wrapper.find(".overflow-y-auto").trigger("scroll");
    await nextTick();

    const btn = wrapper.find("button.absolute.bottom-28");
    expect(btn.exists()).toBe(true);
    await btn.trigger("click");

    // scrollToBottom sets isAutoScrollEnabled = true synchronously, then chains
    // nextTick → rAF. Flush both so the DOM hides the button.
    await nextTick();
    await flushPromises();

    // Verify scrollTo was called with smooth behavior via the rAF.
    // Do NOT advance the 500ms smooth-scroll timer — that would call onScroll() which
    // would re-read scrollTop=0 and flip isAutoScrollEnabled back to false.
    expect(scrollToSpy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" }),
    );
    // isAutoScrollEnabled is true (set synchronously on click), so button is hidden.
    expect(wrapper.find("button.absolute.bottom-28").exists()).toBe(false);
  });

  // ------------------------------------------------------------------ onSend / onStop

  it("onSend: ChatInput send event calls sendMessage with the supplied text", async () => {
    mockSendMessage.mockClear();

    const wrapper = mountChatView();
    await flushPromises();

    const chatInput = wrapper.findComponent({ name: "ChatInput" });
    await chatInput.vm.$emit("send", "Hello world", undefined, false, undefined, undefined);
    await flushPromises();

    expect(mockSendMessage).toHaveBeenCalledWith("Hello world", undefined, false, undefined, undefined);
  });

  it("onStop: ChatInput stop event calls stopGeneration", async () => {
    mockStopGeneration.mockClear();

    const wrapper = mountChatView();
    await flushPromises();

    const chatInput = wrapper.findComponent({ name: "ChatInput" });
    await chatInput.vm.$emit("stop");
    await flushPromises();

    expect(mockStopGeneration).toHaveBeenCalled();
  });
});
