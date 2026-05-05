import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsSlider from "./SettingsSlider.vue";

function mkWrapper(
  overrides: Partial<InstanceType<typeof SettingsSlider>["$props"]> = {},
) {
  return mount(SettingsSlider, {
    props: {
      label: "Temperature",
      modelValue: 0.5,
      min: 0,
      max: 1,
      step: 0.1,
      ...overrides,
    },
  });
}

describe("SettingsSlider", () => {
  it("renders label text", () => {
    const wrapper = mkWrapper({ label: "My Slider" });
    expect(wrapper.text()).toContain("My Slider");
  });

  it("label for matches input id", () => {
    const wrapper = mkWrapper();
    const label = wrapper.find("label");
    const input = wrapper.find("input[type='range']");
    expect(label.attributes("for")).toBeTruthy();
    expect(label.attributes("for")).toBe(input.attributes("id"));
  });

  it("displays formatted value", () => {
    const wrapper = mkWrapper({ modelValue: 0.7, step: 0.1 });
    expect(wrapper.text()).toContain("0.7");
  });

  it("uses formatValue prop when provided", () => {
    const wrapper = mkWrapper({
      modelValue: 5,
      step: 1,
      formatValue: (v) => `${v}x`,
    });
    expect(wrapper.text()).toContain("5x");
  });

  it("emits update:modelValue as integer when step is integral", async () => {
    const wrapper = mkWrapper({ modelValue: 3, min: 0, max: 10, step: 1 });
    const input = wrapper.find("input[type='range']");
    Object.defineProperty(input.element, "value", {
      value: "7",
      configurable: true,
    });
    await input.trigger("input");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(typeof emitted![0][0]).toBe("number");
    expect(emitted![0][0]).toBe(7);
  });

  it("emits update:modelValue as float when step is fractional", async () => {
    const wrapper = mkWrapper({ modelValue: 0.3, min: 0, max: 1, step: 0.1 });
    const input = wrapper.find("input[type='range']");
    Object.defineProperty(input.element, "value", {
      value: "0.8",
      configurable: true,
    });
    await input.trigger("input");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toBeCloseTo(0.8);
  });

  it("shows subtitle when provided", () => {
    const wrapper = mkWrapper({ subtitle: "Controls randomness" });
    expect(wrapper.text()).toContain("Controls randomness");
  });

  it("shows Global badge when showBadge is true", () => {
    const wrapper = mkWrapper({ showBadge: true });
    expect(wrapper.text()).toContain("Global");
  });
});
