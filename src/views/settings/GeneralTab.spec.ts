import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Capture openModal spy at hoisted scope so it's available in assertions
const mockOpenModal = vi.hoisted(() => vi.fn());

vi.mock("../../composables/useConfirmationModal", async () => {
  const { ref } = await import("vue");
  return {
    useConfirmationModal: () => ({
      modal: ref({
        show: false,
        title: "",
        message: "",
        confirmLabel: "",
        kind: "info",
      }),
      openModal: mockOpenModal,
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }),
  };
});

import GeneralTab from "./GeneralTab.vue";

const globalStubs = {
  SettingsRow: { template: "<div><slot name='control' /></div>" },
  ToggleSwitch: {
    name: "ToggleSwitch",
    template: "<button class='toggle-switch' @click=\"$emit('change', !value)\" />",
    props: ["value"],
    emits: ["change"],
  },
  ConfirmationModal: true,
  Transition: { template: "<div><slot /></div>" },
};

describe("GeneralTab — confirmReset", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockOpenModal.mockClear();
  });

  it("clicking 'Reset all' button calls openModal with danger kind", async () => {
    const wrapper = mount(GeneralTab, {
      global: { stubs: globalStubs },
    });
    await flushPromises();

    const resetBtn = wrapper.findAll("button").find((b) => b.text() === "Reset all");
    expect(resetBtn).toBeDefined();

    await resetBtn!.trigger("click");

    expect(mockOpenModal).toHaveBeenCalledOnce();
    expect(mockOpenModal).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "danger",
        confirmLabel: "Reset",
      }),
    );
  });

  it("onConfirm callback from confirmReset calls settingsStore.resetToDefaults", async () => {
    const { useSettingsStore } = await import("../../stores/settings");
    const settingsStore = useSettingsStore();
    const resetSpy = vi.spyOn(settingsStore, "resetToDefaults").mockResolvedValue(undefined);

    const wrapper = mount(GeneralTab, {
      global: { stubs: globalStubs },
    });
    await flushPromises();

    const resetBtn = wrapper.findAll("button").find((b) => b.text() === "Reset all");
    await resetBtn!.trigger("click");

    // Extract and invoke the onConfirm callback captured by openModal
    const callArgs = mockOpenModal.mock.calls[0][0] as { onConfirm: () => Promise<void> };
    await callArgs.onConfirm();

    expect(resetSpy).toHaveBeenCalledOnce();
  });

  it("ToggleSwitch @change fires updateSetting for cloud toggle", async () => {
    const { useSettingsStore } = await import("../../stores/settings");
    const settingsStore = useSettingsStore();
    const updateSpy = vi.spyOn(settingsStore, "updateSetting").mockResolvedValue(undefined);

    const wrapper = mount(GeneralTab, {
      global: { stubs: globalStubs },
    });
    await flushPromises();

    // Click the first toggle (cloud toggle)
    const toggles = wrapper.findAll(".toggle-switch");
    expect(toggles.length).toBeGreaterThan(0);
    await toggles[0].trigger("click");
    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith("cloud", expect.any(Boolean));
  });

  it("theme button @click calls setTheme", async () => {
    const { useSettingsStore } = await import("../../stores/settings");
    const settingsStore = useSettingsStore();
    const setThemeSpy = vi.spyOn(settingsStore, "setTheme").mockImplementation(() => {});

    const wrapper = mount(GeneralTab, {
      global: { stubs: globalStubs },
    });
    await flushPromises();

    // Theme buttons are in the .settings-card section
    const themeButtons = wrapper.findAll("button.theme-option");
    expect(themeButtons.length).toBeGreaterThan(0);
    await themeButtons[0].trigger("click");
    await flushPromises();

    expect(setThemeSpy).toHaveBeenCalled();
  });
});
