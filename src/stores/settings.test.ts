import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useSettingsStore, BUILTIN_PRESETS } from "./settings";
import type { Preset, PresetOptions } from "../types/settings";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => mockInvoke(cmd, args),
}));

const TEST_OPTIONS: PresetOptions = {
  temperature: 0.5,
  top_p: 0.8,
  top_k: 30,
  num_ctx: 4096,
  repeat_penalty: 1.05,
  repeat_last_n: 64,
};

describe("useSettingsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("initialize loads all settings including complex objects", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue({
      theme: "dark",
      fontSize: "16",
      compactMode: "true",
      notificationsEnabled: "false",
      chatOptions: JSON.stringify({ temperature: 0.5 }),
    });

    await store.initialize();

    expect(mockInvoke).toHaveBeenCalledWith("get_all_settings", undefined);
    expect(store.theme).toBe("dark");
    expect(store.fontSize).toBe(16);
    expect(store.compactMode).toBe(true);
    expect(store.notificationsEnabled).toBe(false);
    expect(store.chatOptions.temperature).toBe(0.5);
    expect(store.chatOptions.top_p).toBe(0.9);
  });

  it("initialize restores stop sequences from chatOptions JSON blob", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue({
      chatOptions: JSON.stringify({ temperature: 0.5, stop: ["###", "<END>"] }),
    });

    await store.initialize();

    expect(store.chatOptions.stop).toEqual(["###", "<END>"]);
  });

  it("updateChatOptions serializes stop array into chatOptions JSON blob", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue({});
    await store.initialize();

    mockInvoke.mockResolvedValue(undefined);
    await store.updateChatOptions({ stop: ["\\n\\n", "END"] });

    const call = mockInvoke.mock.calls.find(
      ([cmd]: [string]) => cmd === "set_setting",
    );
    expect(call).toBeDefined();
    const serialized = JSON.parse(call![1].value as string);
    expect(serialized.stop).toEqual(["\\n\\n", "END"]);
  });

  it("initialize loads defaultPresetId from db", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue({ defaultPresetId: "code" });

    await store.initialize();

    expect(store.defaultPresetId).toBe("code");
  });

  it("initialize loads user presets and merges with builtins", async () => {
    const store = useSettingsStore();
    const userPreset: Preset = {
      id: "custom-1",
      name: "My Custom",
      isBuiltin: false,
      options: TEST_OPTIONS,
    };
    mockInvoke.mockResolvedValue({
      userPresets: JSON.stringify([userPreset]),
    });

    await store.initialize();

    expect(store.presets.some((p) => p.id === "creative")).toBe(true);
    expect(store.presets.some((p) => p.id === "custom-1")).toBe(true);
  });

  it("updateSetting calls invoke with JSON string for complex values", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue(null);

    await store.updateSetting("chatOptions", {
      ...store.chatOptions,
      temperature: 0.8,
    });

    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "chatOptions",
      value: JSON.stringify(store.chatOptions),
    });
    expect(store.chatOptions.temperature).toBe(0.8);
  });

  it("updateChatOptions merges options and saves", async () => {
    const store = useSettingsStore();
    store.chatOptions = { ...store.chatOptions, temperature: 0.7, top_p: 0.9 };
    mockInvoke.mockResolvedValue(null);

    await store.updateChatOptions({ temperature: 1.0 });

    expect(store.chatOptions.temperature).toBe(1.0);
    expect(store.chatOptions.top_p).toBe(0.9);
    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "chatOptions",
      value: JSON.stringify(store.chatOptions),
    });
  });

  it("updateDefaultPreset persists and updates state", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue(null);

    await store.updateDefaultPreset("creative");

    expect(store.defaultPresetId).toBe("creative");
    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "defaultPresetId",
      value: "creative",
    });
    // Also syncs chatOptions so Rust-side merge_with_fallback stays correct
    expect(store.chatOptions.temperature).toBe(1.0);
    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "chatOptions",
      value: JSON.stringify(store.chatOptions),
    });
  });

  it("saveAsPreset adds user preset with provided options", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue(null);
    const initialCount = store.presets.length;

    await store.saveAsPreset("My Preset", TEST_OPTIONS);

    expect(store.presets).toHaveLength(initialCount + 1);
    const saved = store.presets.find((p) => p.name === "My Preset");
    expect(saved).toBeDefined();
    expect(saved?.isBuiltin).toBe(false);
    expect(saved?.options).toEqual(TEST_OPTIONS);
    expect(mockInvoke).toHaveBeenCalledWith("set_setting", {
      key: "userPresets",
      value: JSON.stringify([saved]),
    });
  });

  it("deletePreset removes user preset", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue(null);
    await store.saveAsPreset("Temp", TEST_OPTIONS);
    const saved = store.presets.find((p) => p.name === "Temp")!;
    mockInvoke.mockClear();

    await store.deletePreset(saved.id);

    expect(store.presets.find((p) => p.id === saved.id)).toBeUndefined();
  });

  it("deletePreset resets defaultPresetId to 'balanced' if the deleted preset was default", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue(null);
    await store.saveAsPreset("Temp", TEST_OPTIONS);
    const saved = store.presets.find((p) => p.name === "Temp")!;
    store.defaultPresetId = saved.id;
    mockInvoke.mockClear();

    await store.deletePreset(saved.id);

    expect(store.defaultPresetId).toBe("balanced");
  });

  it("deletePreset does not remove builtin presets", async () => {
    const store = useSettingsStore();
    mockInvoke.mockResolvedValue(null);
    const initialCount = store.presets.length;

    await store.deletePreset("creative");

    expect(store.presets).toHaveLength(initialCount);
  });
});
