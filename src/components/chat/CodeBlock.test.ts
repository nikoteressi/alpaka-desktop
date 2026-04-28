import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

vi.mock("../../lib/markdown", () => ({
  highlight: vi
    .fn()
    .mockResolvedValue('<pre class="shiki"><code>x</code></pre>'),
}));

const { default: CodeBlock } = await import("./CodeBlock.vue");

const makeCode = (lines: number) =>
  Array.from({ length: lines }, (_, i) => `line ${i + 1}`).join("\n");

describe("CodeBlock — collapse behavior", () => {
  it("does not show collapse button when code is ≤ 40 lines", async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: makeCode(40), language: "ts" },
    });
    await nextTick();
    expect(wrapper.find(".collapse-button").exists()).toBe(false);
  });

  it("shows collapse button when code is > 40 lines and not streaming", async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: makeCode(41), language: "ts", isStreaming: false },
    });
    await nextTick();
    expect(wrapper.find(".collapse-button").exists()).toBe(true);
    expect(wrapper.find(".collapse-button").text()).toContain("more lines");
  });

  it("hides collapse button while streaming regardless of line count", async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: makeCode(100), language: "ts", isStreaming: true },
    });
    await nextTick();
    expect(wrapper.find(".collapse-button").exists()).toBe(false);
  });

  it("expands on button click and shows collapse text", async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: makeCode(60), language: "ts", isStreaming: false },
    });
    await nextTick();
    const btn = wrapper.find(".collapse-button");
    await btn.trigger("click");
    expect(btn.text()).toContain("Show less");
  });

  it("shows correct hidden line count in button label", async () => {
    const wrapper = mount(CodeBlock, {
      props: { code: makeCode(50), language: "ts", isStreaming: false },
    });
    await nextTick();
    // 50 total - 25 shown = 25 hidden
    expect(wrapper.find(".collapse-button").text()).toContain("25");
  });
});
