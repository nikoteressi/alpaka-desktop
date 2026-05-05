import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import PresetEditor from "./PresetEditor.vue";
import { useSettingsStore } from "../../stores/settings";

// --- Module-level mocks ---

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Stub heavy child components so we test PresetEditor logic only
const SettingsSliderStub = {
  name: "SettingsSlider",
  template: "<div />",
  props: ["label", "modelValue", "min", "max", "step", "compact"],
  emits: ["update:modelValue"],
};
const MirostatSelectorStub = {
  name: "MirostatSelector",
  template: "<div />",
  props: ["modelValue", "compact"],
  emits: ["update:modelValue"],
};
const ConfirmationModalStub = {
  name: "ConfirmationModal",
  template: "<div />",
  props: ["show", "title", "message", "confirmLabel", "kind"],
  emits: ["confirm", "cancel"],
};
const CustomTooltipStub = {
  name: "CustomTooltip",
  template: "<slot />",
  props: ["text", "wrapperClass"],
};

const GLOBAL_STUBS = {
  SettingsSlider: SettingsSliderStub,
  MirostatSelector: MirostatSelectorStub,
  ConfirmationModal: ConfirmationModalStub,
  CustomTooltip: CustomTooltipStub,
};

function mountEditor() {
  return mount(PresetEditor, { global: { stubs: GLOBAL_STUBS } });
}

// --- Tests ---

describe("PresetEditor — rendering", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("renders without crashing", () => {
    const wrapper = mountEditor();
    expect(wrapper.exists()).toBe(true);
  });

  it("displays builtin preset names from the settings store", () => {
    const wrapper = mountEditor();
    const text = wrapper.text();
    // BUILTIN_PRESETS always contain at least "Balanced"
    expect(text).toContain("Balanced");
  });

  it('shows "Default" badge on the defaultPresetId preset', () => {
    const settingsStore = useSettingsStore();
    settingsStore.defaultPresetId = "balanced";
    const wrapper = mountEditor();
    expect(wrapper.text()).toContain("Default");
  });

  it('shows "+ Save as preset" button when not in save mode', () => {
    const wrapper = mountEditor();
    expect(wrapper.text()).toContain("+ Save as preset");
  });
});

describe("PresetEditor — selectPreviewPreset", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("clicking a preset row updates previewPresetId on the vm", async () => {
    const settingsStore = useSettingsStore();
    // ensure balanced preset exists (it's a builtin)
    const balancedPreset = settingsStore.presets.find(
      (p) => p.id === "balanced",
    );
    expect(balancedPreset).toBeDefined();

    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as { previewPresetId: string };

    // Find the first clickable preset row (div[@click])
    const rows = wrapper.findAll(".cursor-pointer.rounded-xl");
    expect(rows.length).toBeGreaterThan(0);
    await rows[0].trigger("click");

    expect(vm.previewPresetId).toBeTruthy();
  });

  it("clicking a preset loads its options into localOptions", async () => {
    const settingsStore = useSettingsStore();
    const precisePreset = settingsStore.presets.find((p) => p.id === "precise");
    expect(precisePreset).toBeDefined();

    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      selectPreviewPreset: (id: string) => void;
      localOptions: Record<string, unknown>;
      previewPresetId: string;
    };

    vm.selectPreviewPreset("precise");
    await wrapper.vm.$nextTick();

    expect(vm.previewPresetId).toBe("precise");
    expect(vm.localOptions.temperature).toBe(
      precisePreset!.options.temperature,
    );
  });
});

describe("PresetEditor — updateLocalOption / updateLocalMirostat", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("updateLocalOption clears previewPresetId and updates the option", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      updateLocalOption: (key: string, value: number) => void;
      previewPresetId: string;
      localOptions: Record<string, unknown>;
    };

    // Pre-select a preset first
    vm.previewPresetId = "balanced";
    vm.updateLocalOption("temperature", 0.42);
    await wrapper.vm.$nextTick();

    expect(vm.previewPresetId).toBe("");
    expect(vm.localOptions.temperature).toBe(0.42);
  });

  it("updateLocalMirostat clears previewPresetId and sets mirostat value", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      updateLocalMirostat: (value: 0 | 1 | 2) => void;
      previewPresetId: string;
      localOptions: Record<string, unknown>;
    };

    vm.previewPresetId = "balanced";
    vm.updateLocalMirostat(2);
    await wrapper.vm.$nextTick();

    expect(vm.previewPresetId).toBe("");
    expect(vm.localOptions.mirostat).toBe(2);
  });

  it("localMirostat computed returns current mirostat value", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      updateLocalMirostat: (value: 0 | 1 | 2) => void;
      localMirostat: number;
    };

    vm.updateLocalMirostat(1);
    await wrapper.vm.$nextTick();

    expect(vm.localMirostat).toBe(1);
  });
});

describe("PresetEditor — save preset flow", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("startSavingPreset shows the name input form", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      startSavingPreset: () => Promise<void>;
      savingPreset: boolean;
    };

    await vm.startSavingPreset();
    await wrapper.vm.$nextTick();

    expect(vm.savingPreset).toBe(true);
    expect(wrapper.find('input[placeholder="Preset name"]').exists()).toBe(
      true,
    );
  });

  it("cancelSavePreset hides the name input form", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      startSavingPreset: () => Promise<void>;
      cancelSavePreset: () => void;
      savingPreset: boolean;
      newPresetName: string;
    };

    await vm.startSavingPreset();
    vm.newPresetName = "My Preset";
    vm.cancelSavePreset();
    await wrapper.vm.$nextTick();

    expect(vm.savingPreset).toBe(false);
    expect(vm.newPresetName).toBe("");
  });

  it("commitSavePreset with a valid name calls settingsStore.saveAsPreset", async () => {
    const settingsStore = useSettingsStore();
    const saveSpy = vi.spyOn(settingsStore, "saveAsPreset").mockResolvedValue();

    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      startSavingPreset: () => Promise<void>;
      commitSavePreset: () => Promise<void>;
      newPresetName: string;
      localOptions: Record<string, unknown>;
      savingPreset: boolean;
    };

    await vm.startSavingPreset();
    vm.newPresetName = "My Custom Preset";
    await vm.commitSavePreset();
    await wrapper.vm.$nextTick();

    expect(saveSpy).toHaveBeenCalledWith("My Custom Preset", vm.localOptions);
    expect(vm.savingPreset).toBe(false);
  });

  it("commitSavePreset with empty name is a no-op", async () => {
    const settingsStore = useSettingsStore();
    const saveSpy = vi.spyOn(settingsStore, "saveAsPreset").mockResolvedValue();

    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      startSavingPreset: () => Promise<void>;
      commitSavePreset: () => Promise<void>;
      newPresetName: string;
    };

    await vm.startSavingPreset();
    vm.newPresetName = "   "; // whitespace only
    await vm.commitSavePreset();

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("Save button is disabled when preset name is empty", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      startSavingPreset: () => Promise<void>;
    };

    await vm.startSavingPreset();
    await wrapper.vm.$nextTick();

    const saveBtn = wrapper.findAll("button").find((b) => b.text() === "Save");
    expect(saveBtn!.attributes("disabled")).toBeDefined();
  });
});

describe("PresetEditor — delete preset flow", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("confirmDeletePreset opens the confirmation modal", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      confirmDeletePreset: (id: string, name: string) => void;
      modal: { show: boolean; title: string };
    };

    vm.confirmDeletePreset("my-preset", "My Preset");
    await wrapper.vm.$nextTick();

    expect(vm.modal.show).toBe(true);
    expect(vm.modal.title).toBe("Delete Preset");
  });

  it("confirming the modal calls settingsStore.deletePreset with the correct id", async () => {
    const settingsStore = useSettingsStore();
    // Add a user preset so deletePreset can find it
    settingsStore.presets.push({
      id: "custom-1",
      name: "Custom One",
      isBuiltin: false,
      options: {
        temperature: 0.5,
        top_p: 0.9,
        top_k: 40,
        num_ctx: 4096,
        repeat_penalty: 1.1,
        repeat_last_n: 64,
      },
    });
    const deleteSpy = vi
      .spyOn(settingsStore, "deletePreset")
      .mockResolvedValue();

    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      confirmDeletePreset: (id: string, name: string) => void;
      onConfirm: () => void;
      modal: { show: boolean };
    };

    vm.confirmDeletePreset("custom-1", "Custom One");
    await wrapper.vm.$nextTick();

    vm.onConfirm();
    await wrapper.vm.$nextTick();

    expect(deleteSpy).toHaveBeenCalledWith("custom-1");
  });
});

describe("PresetEditor — Set as Default button", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("calls updateDefaultPreset when Set as Default is clicked", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.defaultPresetId = "balanced";
    const updateSpy = vi
      .spyOn(settingsStore, "updateDefaultPreset")
      .mockResolvedValue();

    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      selectPreviewPreset: (id: string) => void;
    };

    // Select a different preset so the button appears
    vm.selectPreviewPreset("creative");
    await wrapper.vm.$nextTick();

    const setDefaultBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Set as Default"));
    expect(setDefaultBtn).toBeDefined();
    await setDefaultBtn!.trigger("click");

    expect(updateSpy).toHaveBeenCalledWith("creative");
  });

  it("Set as Default button is hidden when the selected preset is already the default", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.defaultPresetId = "balanced";

    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      selectPreviewPreset: (id: string) => void;
    };
    vm.selectPreviewPreset("balanced");
    await wrapper.vm.$nextTick();

    const setDefaultBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Set as Default"));
    expect(setDefaultBtn).toBeUndefined();
  });
});

describe("PresetEditor — chatOptions watcher", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("updates localOptions when chatOptions change and previewPresetId is empty", async () => {
    const settingsStore = useSettingsStore();

    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      previewPresetId: string;
      localOptions: Record<string, unknown>;
    };

    // Clear preset selection so the watcher branch fires
    vm.previewPresetId = "";
    await wrapper.vm.$nextTick();

    settingsStore.chatOptions = {
      ...settingsStore.chatOptions,
      temperature: 0.99,
    };
    await wrapper.vm.$nextTick();

    expect(vm.localOptions.temperature).toBe(0.99);
  });

  it("does NOT update localOptions when previewPresetId is set", async () => {
    const settingsStore = useSettingsStore();

    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as {
      previewPresetId: string;
      localOptions: Record<string, unknown>;
    };

    const originalTemp = vm.localOptions.temperature;
    vm.previewPresetId = "balanced";
    await wrapper.vm.$nextTick();

    settingsStore.chatOptions = {
      ...settingsStore.chatOptions,
      temperature: 0.01,
    };
    await wrapper.vm.$nextTick();

    expect(vm.localOptions.temperature).toBe(originalTemp);
  });
});
