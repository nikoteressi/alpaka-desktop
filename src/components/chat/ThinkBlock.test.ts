import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

vi.mock("../../lib/markdown", () => ({
  renderMarkdown: vi.fn((content: string) => `<p>${content}</p>`),
}));

vi.mock("../../composables/useCollapsibleState", () => ({
  useCollapsibleState: vi.fn(() => ({
    isOpen: { value: true },
    toggle: vi.fn(),
    setOpen: vi.fn(),
  })),
}));

const { default: ThinkBlock } = await import("./ThinkBlock.vue");

describe("ThinkBlock — markdown rendering", () => {
  it("renders content as plain text while isThinking is true", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "**bold**", isThinking: true },
    });
    await nextTick();
    const content = wrapper.find(".think-content");
    expect(content.text()).toContain("**bold**");
    expect(content.html()).not.toContain("<strong>");
  });

  it("renders content as markdown once isThinking is false", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "some content", isThinking: false },
    });
    await nextTick();
    const content = wrapper.find(".think-content");
    expect(content.html()).toContain("<p>");
  });

  it("max-height is 380px on the content container", async () => {
    const wrapper = mount(ThinkBlock, {
      props: { content: "test", isThinking: false },
    });
    await nextTick();
    const content = wrapper.find(".think-content");
    expect(content.attributes("style") ?? "").toContain("380px");
  });
});
