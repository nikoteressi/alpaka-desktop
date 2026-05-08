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

  it("shows edit textarea after clicking edit button on user message", async () => {
    const wrapper = mount(MessageBubble, {
      props: { message: { role: "user", content: "Original text" } },
    });
    await wrapper.find(".user-message").trigger("mouseenter");
    await wrapper.find('[aria-label="Edit"]').trigger("pointerdown");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("textarea").exists()).toBe(true);
    expect(
      (wrapper.find("textarea").element as HTMLTextAreaElement).value,
    ).toBe("Original text");
  });

  it("cancelEdit hides the textarea and resets content", async () => {
    const wrapper = mount(MessageBubble, {
      props: { message: { role: "user", content: "Original text" } },
    });
    await wrapper.find(".user-message").trigger("mouseenter");
    await wrapper.find('[aria-label="Edit"]').trigger("pointerdown");
    await wrapper.vm.$nextTick();
    await wrapper.find(".edit-pill__btn").trigger("pointerdown");
    await wrapper.vm.$nextTick();
    // v-show hides the edit container; the normal bubble reappears (v-if="!isEditing")
    expect(wrapper.find(".user-bubble").exists()).toBe(true);
  });

  it("applyEdit emits editConfirm with trimmed content", async () => {
    const wrapper = mount(MessageBubble, {
      props: { message: { role: "user", content: "Original" } },
    });
    await wrapper.find(".user-message").trigger("mouseenter");
    await wrapper.find('[aria-label="Edit"]').trigger("pointerdown");
    await wrapper.vm.$nextTick();
    const textarea = wrapper.find("textarea");
    await textarea.setValue("  Updated content  ");
    await wrapper.find(".edit-pill__btn--apply").trigger("click");
    expect(wrapper.emitted("editConfirm")).toEqual([["Updated content"]]);
  });
});
