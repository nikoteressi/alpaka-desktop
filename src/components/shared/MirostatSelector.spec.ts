import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MirostatSelector from "./MirostatSelector.vue";

describe("MirostatSelector", () => {
  it("renders three mode buttons (Off/Mirostat1/Mirostat2)", () => {
    const wrapper = mount(MirostatSelector, { props: { modelValue: 0 } });
    const buttons = wrapper.findAll("button");
    const labels = buttons.map((b) => b.text());
    expect(labels).toContain("Off");
    expect(labels).toContain("Mirostat 1");
    expect(labels).toContain("Mirostat 2");
  });

  it("emits update:modelValue with 1 when Mirostat 1 is clicked", async () => {
    const wrapper = mount(MirostatSelector, { props: { modelValue: 0 } });
    const buttons = wrapper.findAll("button");
    const m1 = buttons.find((b) => b.text() === "Mirostat 1");
    await m1?.trigger("click");
    expect(wrapper.emitted("update:modelValue")![0][0]).toBe(1);
  });

  it("emits update:modelValue with 0 when Off is clicked", async () => {
    const wrapper = mount(MirostatSelector, { props: { modelValue: 2 } });
    const buttons = wrapper.findAll("button");
    const off = buttons.find((b) => b.text() === "Off");
    await off?.trigger("click");
    expect(wrapper.emitted("update:modelValue")![0][0]).toBe(0);
  });
});
