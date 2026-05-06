import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsRow from "./SettingsRow.vue";

describe("SettingsRow", () => {
  it("renders without crashing", () => {
    const wrapper = mount(SettingsRow, { props: {} });
    expect(wrapper.exists()).toBe(true);
  });

  it("renders label slot content", () => {
    const wrapper = mount(SettingsRow, {
      props: {},
      slots: { label: "My Setting" },
    });
    expect(wrapper.text()).toContain("My Setting");
  });

  it("renders subtitle slot content", () => {
    const wrapper = mount(SettingsRow, {
      props: {},
      slots: { subtitle: "A helpful description" },
    });
    expect(wrapper.text()).toContain("A helpful description");
  });

  it("renders control slot content", () => {
    const wrapper = mount(SettingsRow, {
      props: {},
      slots: { control: '<button data-testid="ctrl">Click</button>' },
    });
    expect(wrapper.find('[data-testid="ctrl"]').exists()).toBe(true);
  });

  it("renders an icon when icon prop is provided", () => {
    const wrapper = mount(SettingsRow, { props: { icon: "cloud" } });
    expect(wrapper.find(".row-icon").exists()).toBe(true);
  });
});
