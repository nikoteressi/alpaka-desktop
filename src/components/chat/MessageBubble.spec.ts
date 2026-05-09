import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import MessageBubble from "./MessageBubble.vue";
import { useChatStore } from "../../stores/chat";

describe("MessageBubble.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders user message correctly", () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: { role: "user", content: "Hello from user" },
      },
    });
    expect(wrapper.text()).toContain("Hello from user");
    expect(wrapper.find(".user-bubble").exists()).toBe(true);
  });

  it("renders assistant thinking block with correct label when isThinking is true", async () => {
    const chatStore = useChatStore();
    chatStore.streaming.isStreaming = true;
    chatStore.streaming.isThinking = true;
    chatStore.streaming.activeMessageParts = [
      { type: "think", content: "Thought process here..." },
    ];

    const wrapper = mount(MessageBubble, {
      props: {
        message: { role: "assistant", content: "" },
        isStreaming: true,
        isThinking: true,
      },
    });

    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Thinking...");
    expect(wrapper.text()).toContain("Thought process here...");
  });

  it("renders assistant markdown content correctly", async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: { role: "assistant", content: "**Bolded Content**" },
        isStreaming: false,
      },
    });

    await wrapper.vm.$nextTick();
    const htmlDiv = wrapper.find(".rendered-markdown");
    expect(htmlDiv.html()).toContain("<strong>Bolded Content</strong>");
  });

  it("emits edit event when edit button is clicked", async () => {
    const wrapper = mount(MessageBubble, {
      props: { message: { role: "user", content: "Original text" } },
    });
    await wrapper.find('[aria-label="Edit"]').trigger("click");
    expect(wrapper.emitted("edit")).toBeTruthy();
  });

  it("toolMessages — collects adjacent tool messages before an assistant message", async () => {
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-1";
    chatStore.messages["conv-1"] = [
      { id: "u1", role: "user", content: "Query" },
      {
        id: "t1",
        role: "tool",
        content: JSON.stringify({ results: [] }),
        toolName: "some_tool",
      },
      {
        id: "t2",
        role: "tool",
        content: JSON.stringify({ results: [] }),
        toolName: "other_tool",
      },
      { id: "a1", role: "assistant", content: "Answer" },
    ];

    const wrapper = mount(MessageBubble, {
      props: {
        message: { id: "a1", role: "assistant", content: "Answer" },
        messageId: "a1",
        isStreaming: false,
      },
    });

    await wrapper.vm.$nextTick();
    // If toolMessages throws, the component won't render at all. Verify it rendered.
    expect(wrapper.find('[data-role="assistant"]').exists()).toBe(true);
  });

  it("finalSearchResults — renders SearchBlock when tool message contains web_search results", async () => {
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-1";
    chatStore.messages["conv-1"] = [
      {
        id: "t1",
        role: "tool",
        content: JSON.stringify({
          results: [{ title: "Result", url: "https://example.com", snippet: "A snippet" }],
        }),
        toolName: "web_search",
      },
      { id: "a1", role: "assistant", content: "Based on search..." },
    ];

    const wrapper = mount(MessageBubble, {
      props: {
        message: { id: "a1", role: "assistant", content: "Based on search..." },
        messageId: "a1",
        isStreaming: false,
      },
    });

    await wrapper.vm.$nextTick();
    expect(wrapper.find(".search-block").exists()).toBe(true);
  });

  it("finalSearchResults — does not render SearchBlock when tool message JSON is invalid", async () => {
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-1";
    chatStore.messages["conv-1"] = [
      {
        id: "t1",
        role: "tool",
        content: "not-json",
        toolName: "web_search",
      },
      { id: "a1", role: "assistant", content: "Answer" },
    ];

    const wrapper = mount(MessageBubble, {
      props: {
        message: { id: "a1", role: "assistant", content: "Answer" },
        messageId: "a1",
        isStreaming: false,
      },
    });

    await wrapper.vm.$nextTick();
    // parse error → finalSearchResults returns [] → SearchBlock not rendered
    expect(wrapper.find(".search-block").exists()).toBe(false);
  });

  it("loadedThinkPart — renders native ThinkBlock when message.thinking is set and not streaming", async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: { role: "assistant", content: "Answer", thinking: "inner thoughts" },
        isStreaming: false,
      },
    });

    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("inner thoughts");
  });

  it("loadedThinkPart — does not render native ThinkBlock when streaming", async () => {
    const chatStore = useChatStore();
    chatStore.streaming.activeMessageParts = [];

    const wrapper = mount(MessageBubble, {
      props: {
        message: { role: "assistant", content: "", thinking: "inner thoughts" },
        isStreaming: true,
      },
    });

    await wrapper.vm.$nextTick();
    // loadedThinkPart returns null while streaming — thinking content must not appear
    expect(wrapper.text()).not.toContain("inner thoughts");
  });

  it("activeChild — finds assistant message that is a child of the current user message", async () => {
    const chatStore = useChatStore();
    chatStore.activeConversationId = "conv-1";
    chatStore.messages["conv-1"] = [
      { id: "u1", role: "user", content: "User prompt" },
      { id: "a1", role: "assistant", content: "Response", parentId: "u1" },
    ];

    const wrapper = mount(MessageBubble, {
      props: {
        message: { id: "u1", role: "user", content: "User prompt" },
      },
    });

    await wrapper.vm.$nextTick();
    // If activeChild throws, the component won't mount correctly
    expect(wrapper.find('[data-role="user"]').exists()).toBe(true);
  });

  it("onRegenerate — emits regenerate with the message parentId", async () => {
    const wrapper = mount(MessageBubble, {
      props: {
        message: { role: "assistant", content: "Answer", parentId: "parent-123" },
        isStreaming: false,
      },
    });

    await wrapper.find('[aria-label="Regenerate"]').trigger("click");
    expect(wrapper.emitted("regenerate")?.[0]?.[0]).toBe("parent-123");
  });
});
