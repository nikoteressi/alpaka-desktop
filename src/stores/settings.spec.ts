import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const mockInvoke = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}));

import { useSettingsStore } from "./settings";

describe("settings store — setTheme and resetToDefaults", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("setTheme calls updateSetting with the given theme", async () => {
    const store = useSettingsStore();
    store.setTheme("dark");
    // updateSetting is async — give it a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(mockInvoke).toHaveBeenCalledWith(
      "set_setting",
      expect.objectContaining({ key: "theme", value: "dark" }),
    );
  });

  it("resetToDefaults calls delete_all_settings and resets state", async () => {
    const store = useSettingsStore();
    store.theme = "light";

    await store.resetToDefaults();

    const calls = mockInvoke.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain("delete_all_settings");
    // After reset, theme should be back to default ("system")
    expect(store.theme).toBe("system");
  });
});
