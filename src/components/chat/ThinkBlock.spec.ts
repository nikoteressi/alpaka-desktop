import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ThinkBlock from "./ThinkBlock.vue";
import type { MessagePart } from "../../types/chat";

const thinkPart = (content: string): MessagePart => ({
  type: "think",
  content,
});

function isHidden(wrapper: ReturnType<typeof mount>): boolean {
  return wrapper
    .find(".think-accordion")
    .classes()
    .includes("think-accordion--closed");
}

describe("ThinkBlock", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("starts expanded when mounted with isThinking: true", () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("reasoning here")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    expect(isHidden(wrapper)).toBe(false);
  });

  it('shows "Thinking..." label while isThinking and isOverallStreaming are true', () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    expect(wrapper.find(".think-header__label").text()).toBe("Thinking...");
  });

  it('shows "Thought for N seconds" label when finished with thinkTime', () => {
    const wrapper = mount(ThinkBlock, {
      props: { parts: [thinkPart("done")], isThinking: false, thinkTime: 3.5 },
    });
    expect(wrapper.find(".think-header__label").text()).toBe(
      "Thought for 4 seconds",
    );
  });

  it('shows "Thought" fallback label when finished without thinkTime', () => {
    const wrapper = mount(ThinkBlock, {
      props: { parts: [thinkPart("")], isThinking: false },
    });
    expect(wrapper.find(".think-header__label").text()).toBe("Thought");
  });

  it("auto-collapses 1500ms after isThinking transitions to false", async () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("reasoning here")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    expect(isHidden(wrapper)).toBe(false);

    await wrapper.setProps({ isThinking: false, isOverallStreaming: false });
    await flushPromises();
    // Not yet collapsed — timer hasn't fired
    expect(isHidden(wrapper)).toBe(false);

    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect(isHidden(wrapper)).toBe(true);
  });

  it("toggle click expands and re-collapses the panel", async () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("some thoughts")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    expect(isHidden(wrapper)).toBe(false);

    await wrapper.setProps({ isThinking: false, isOverallStreaming: false });
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect(isHidden(wrapper)).toBe(true);

    await wrapper.find("button").trigger("click");
    expect(isHidden(wrapper)).toBe(false);

    await wrapper.find("button").trigger("click");
    expect(isHidden(wrapper)).toBe(true);
  });

  it("renders step text inside the scroll area when expanded", () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("the internal reasoning text")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    expect(wrapper.find(".think-scroll-area").text()).toContain(
      "the internal reasoning text",
    );
  });

  it("shows plain text with cursor on the active (last) step while streaming", async () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("**bold**")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    await flushPromises();
    const active = wrapper.find(".think-step__active");
    expect(active.exists()).toBe(true);
    expect(active.text()).toContain("**bold**");
    expect(active.html()).not.toContain("<strong>");
    expect(wrapper.find(".think-cursor").exists()).toBe(true);
  });

  it("renders markdown HTML for completed steps", async () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("**bold**\n\nnext step")],
        isThinking: false,
        isOverallStreaming: false,
      },
    });
    await flushPromises();
    const contents = wrapper.findAll(".think-step__content");
    expect(contents[0].html()).toContain("<strong>bold</strong>");
  });

  it("isOpen ref is true on mount when streaming", () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(true);
  });

  it("isOpen becomes false after auto-collapse timer", async () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("thoughts")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    await wrapper.setProps({ isThinking: false, isOverallStreaming: false });
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(false);
  });

  it("isOpen can be toggled back to true after auto-collapse", async () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("thoughts")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    await wrapper.setProps({ isThinking: false, isOverallStreaming: false });
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(false);

    await wrapper.find("button").trigger("click");
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(true);
  });

  it("toggle click works while isThinking is true (collapsible during streaming)", async () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("")],
        isThinking: true,
        isOverallStreaming: true,
      },
    });
    await wrapper.find("button").trigger("click");
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(false);
  });

  it("splits content into multiple steps on double newlines", async () => {
    const wrapper = mount(ThinkBlock, {
      props: {
        parts: [thinkPart("step one\n\nstep two\n\nstep three")],
        isThinking: false,
        isOverallStreaming: false,
      },
    });
    await flushPromises();
    expect(wrapper.findAll(".think-step").length).toBe(3);
  });
});
