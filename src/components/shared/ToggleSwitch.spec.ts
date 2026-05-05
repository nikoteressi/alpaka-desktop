import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ToggleSwitch from "./ToggleSwitch.vue";

describe("ToggleSwitch", () => {
  it("renders a button", () => {
    const wrapper = mount(ToggleSwitch, { props: { value: false } });
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("emits change with true when clicked while value is false", async () => {
    const wrapper = mount(ToggleSwitch, { props: { value: false } });
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("change")).toBeTruthy();
    expect(wrapper.emitted("change")![0][0]).toBe(true);
  });

  it("emits change with false when clicked while value is true", async () => {
    const wrapper = mount(ToggleSwitch, { props: { value: true } });
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("change")![0][0]).toBe(false);
  });
});
