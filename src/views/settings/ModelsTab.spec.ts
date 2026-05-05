import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

import ModelsTab from "./ModelsTab.vue";
import { useSettingsStore } from "../../stores/settings";

const globalStubs = {
  ModelPathSettings: true,
  GpuLayersSettings: true,
  PresetEditor: true,
  SettingsRow: {
    name: "SettingsRow",
    template: "<div><slot name='control' /></div>",
    props: ["icon"],
  },
};

describe("ModelsTab — context length slider", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("mounts without crashing", async () => {
    const wrapper = mount(ModelsTab, { global: { stubs: globalStubs } });
    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it("onCtxSlider updates chatOptions.num_ctx when slider input fires", async () => {
    const settingsStore = useSettingsStore();
    // Start at index 0 = 4096
    settingsStore.chatOptions = { ...settingsStore.chatOptions, num_ctx: 4096 };

    const wrapper = mount(ModelsTab, { global: { stubs: globalStubs } });
    await flushPromises();

    const slider = wrapper.find("input[type='range']");
    expect(slider.exists()).toBe(true);

    // Simulate selecting index 2 = 16384
    Object.defineProperty(slider.element, "value", {
      get: () => "2",
      configurable: true,
    });
    await slider.trigger("input");
    await flushPromises();

    // CTX_STEPS[2] = 16384
    expect(settingsStore.chatOptions.num_ctx).toBe(16384);
  });

  it("ctxStepIndex computed returns 0 when num_ctx is 4096 (first step)", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.chatOptions = { ...settingsStore.chatOptions, num_ctx: 4096 };

    const wrapper = mount(ModelsTab, { global: { stubs: globalStubs } });
    await flushPromises();

    const slider = wrapper.find("input[type='range']") as {
      element: HTMLInputElement;
    };
    // The :value binding should be 0 for 4096
    expect(slider.element.value).toBe("0");
  });
});
