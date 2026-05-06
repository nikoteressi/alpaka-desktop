import { describe, it, expect } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { nextTick } from "vue";
import ThinkBlock from "./ThinkBlock.vue";

// Selector for the content panel — the innermost scrollable div.
const CONTENT_PANEL = '[style*="max-height: 380px"]';

// The grid accordion wrapper is the sibling of the toggle button.
// When closed, it carries the 'think-accordion--closed' class.
function isHidden(wrapper: ReturnType<typeof mount>): boolean {
  return wrapper
    .find(".think-accordion")
    .classes()
    .includes("think-accordion--closed");
}

describe("ThinkBlock", () => {
  it("starts expanded when mounted with isThinking: true", () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "reasoning here", isThinking: true },
    });

    // Accordion must not have the closed class
    expect(isHidden(wrapper)).toBe(false);
  });

  it('shows "Thinking..." label while isThinking is true', () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "", isThinking: true },
    });

    expect(wrapper.find("button span").text()).toBe("Thinking...");
  });

  it('shows "Thought for X.X seconds" label when isThinking is false and thinkTime is provided', () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "", isThinking: false, thinkTime: 3.5 },
    });

    // Label reflects thinkTime formatted with one decimal place
    expect(wrapper.find("button span").text()).toBe("Thought for 3.5 seconds");
  });

  it('shows "Thoughts" fallback label when isThinking is false and thinkTime is absent', () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "", isThinking: false },
    });

    expect(wrapper.find("button span").text()).toBe("Thoughts");
  });

  it("auto-collapses when isThinking transitions from true to false", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "reasoning here", isThinking: true },
    });

    // Panel must be visible before the transition
    expect(isHidden(wrapper)).toBe(false);

    // Trigger the state transition
    await wrapper.setProps({ isThinking: false });

    // The watcher handler is async (`await nextTick()` inside its body). flushPromises
    // drains all pending microtasks so the watcher body fully completes.
    await flushPromises();

    expect(isHidden(wrapper)).toBe(true);
  });

  it("toggle click expands and re-collapses the panel", async () => {
    // Mount while streaming so the component starts expanded
    const wrapper = mount(ThinkBlock, {
      props: { content: "some thoughts", isThinking: true },
    });

    expect(isHidden(wrapper)).toBe(false);

    // Drive a true→false transition so auto-collapse fires — leaving it collapsed
    await wrapper.setProps({ isThinking: false });
    await flushPromises();
    expect(isHidden(wrapper)).toBe(true);

    // Click once → should expand
    await wrapper.find("button").trigger("click");
    expect(isHidden(wrapper)).toBe(false);

    // Click again → should collapse
    await wrapper.find("button").trigger("click");
    expect(isHidden(wrapper)).toBe(true);
  });

  it("renders content text inside the panel when expanded", () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "the internal reasoning text", isThinking: true },
    });

    const panel = wrapper.find(CONTENT_PANEL);
    expect(panel.exists()).toBe(true);
    expect(panel.text()).toContain("the internal reasoning text");
  });

  // --- isOpen ref state assertions ---

  it("isOpen ref is true on mount", () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "", isThinking: true },
    });
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(true);
  });

  it("isOpen is true while isThinking is true", () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "thoughts", isThinking: true },
    });
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(true);
  });

  it("isOpen becomes false when isThinking transitions from true to false", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "thoughts", isThinking: true },
    });
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(true); // before

    await wrapper.setProps({ isThinking: false });
    await flushPromises();

    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(false); // after
  });

  it("isOpen can be toggled back to true after auto-collapse", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "thoughts", isThinking: true },
    });
    await wrapper.setProps({ isThinking: false });
    await flushPromises();
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(false);

    await wrapper.find("button").trigger("click");
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(true);
  });

  it("toggle click works while isThinking is true (collapsible during streaming)", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "", isThinking: true },
    });
    // Default: open. Click should collapse it — toggling during thinking is intentional (bug #7).
    await wrapper.find("button").trigger("click");
    expect((wrapper.vm as unknown as { isOpen: boolean }).isOpen).toBe(false);
  });

  it("shows plain text (no markdown) while isThinking is true", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "**bold**", isThinking: true },
    });
    await nextTick();
    const content = wrapper.find(".think-content");
    expect(content.text()).toContain("**bold**");
    expect(content.html()).not.toContain("<strong>");
  });

  it("renders markdown HTML once isThinking is false", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "some content", isThinking: false },
    });
    await nextTick();
    const content = wrapper.find(".think-content--rendered");
    expect(content.html()).toContain("<p>");
  });

  it("content container has max-height: 380px", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "test", isThinking: false },
    });
    await nextTick();
    const panel = wrapper.find(CONTENT_PANEL);
    expect(panel.exists()).toBe(true);
  });
});
