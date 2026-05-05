import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

import AdvancedTab from "./AdvancedTab.vue";
import { useSettingsStore } from "../../stores/settings";

const globalStubs = {
  StopSequencesInput: {
    name: "StopSequencesInput",
    template: "<div data-testid='stop-sequences-input' />",
    props: ["modelValue"],
    emits: ["update:modelValue"],
  },
};

describe("AdvancedTab — seed controls", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("mounts without crashing", async () => {
    const wrapper = mount(AdvancedTab, { global: { stubs: globalStubs } });
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it("'Reset to random' button is hidden when seed is undefined", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.chatOptions = { ...settingsStore.chatOptions, seed: undefined };

    const wrapper = mount(AdvancedTab, { global: { stubs: globalStubs } });
    await flushPromises();

    const resetBtn = wrapper.findAll("button").find((b) => b.text() === "Reset to random");
    expect(resetBtn).toBeUndefined();
  });

  it("'Reset to random' button appears when seed is set and clears it on click", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.chatOptions = { ...settingsStore.chatOptions, seed: 42 };

    const wrapper = mount(AdvancedTab, { global: { stubs: globalStubs } });
    await flushPromises();

    const resetBtn = wrapper.findAll("button").find((b) => b.text() === "Reset to random");
    expect(resetBtn).toBeDefined();

    await resetBtn!.trigger("click");
    await flushPromises();

    expect(settingsStore.chatOptions.seed).toBeUndefined();
  });

  it("seed @change handler parses integer and calls updateChatOptions", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.chatOptions = { ...settingsStore.chatOptions, seed: undefined };

    const wrapper = mount(AdvancedTab, { global: { stubs: globalStubs } });
    await flushPromises();

    const input = wrapper.find("input[type='number']");
    expect(input.exists()).toBe(true);

    // Simulate typing "123" then firing change
    Object.defineProperty(input.element, "value", {
      get: () => "123",
      configurable: true,
    });
    await input.trigger("change");
    await flushPromises();

    expect(settingsStore.chatOptions.seed).toBe(123);
  });

  it("seed @change with empty string sets seed to undefined", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.chatOptions = { ...settingsStore.chatOptions, seed: 99 };

    const wrapper = mount(AdvancedTab, { global: { stubs: globalStubs } });
    await flushPromises();

    const input = wrapper.find("input[type='number']");
    Object.defineProperty(input.element, "value", {
      get: () => "",
      configurable: true,
    });
    await input.trigger("change");
    await flushPromises();

    expect(settingsStore.chatOptions.seed).toBeUndefined();
  });
});
