import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AppTabs from "./AppTabs.vue";

const tabs = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];

describe("AppTabs", () => {
  it("renders all tab buttons", () => {
    const wrapper = mount(AppTabs, { props: { modelValue: "a", tabs } });
    const buttons = wrapper.findAll("button.app-tab");
    expect(buttons.length).toBe(3);
  });

  it("tab buttons display the tab name", () => {
    const wrapper = mount(AppTabs, { props: { modelValue: "a", tabs } });
    const names = wrapper.findAll("button.app-tab").map((b) => b.text());
    expect(names).toContain("Alpha");
    expect(names).toContain("Beta");
  });

  it("emits update:modelValue with the tab id when a tab is clicked", async () => {
    const wrapper = mount(AppTabs, { props: { modelValue: "a", tabs } });
    const buttons = wrapper.findAll("button.app-tab");
    await buttons[1].trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")![0][0]).toBe("b");
  });

  it("active tab has the app-tab--active class", () => {
    const wrapper = mount(AppTabs, { props: { modelValue: "b", tabs } });
    const buttons = wrapper.findAll("button.app-tab");
    const activeBtn = buttons.find((b) => b.classes().includes("app-tab--active"));
    expect(activeBtn?.text()).toBe("Beta");
  });
});
