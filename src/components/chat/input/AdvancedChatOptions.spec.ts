import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

const mockInvoke = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: unknown) => mockInvoke(cmd, args),
}));

import AdvancedChatOptions from "./AdvancedChatOptions.vue";
import type { ChatOptions } from "../../../types/settings";

function mountComponent(
  modelValue: Partial<ChatOptions> = {},
  presetId = "",
  model?: string,
) {
  return mount(AdvancedChatOptions, {
    props: { modelValue, presetId, ...(model ? { model } : {}) },
    global: { plugins: [createPinia()] },
  });
}

describe("AdvancedChatOptions — Mirostat controls", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("shows Off/Mirostat1/Mirostat2 buttons", () => {
    const wrapper = mountComponent();
    const buttons = wrapper
      .findAll("button")
      .filter((b) => ["Off", "Mirostat 1", "Mirostat 2"].includes(b.text()));
    expect(buttons).toHaveLength(3);
  });

  it("Off is active by default when no mirostat in modelValue", () => {
    const wrapper = mountComponent({});
    const offBtn = wrapper.findAll("button").find((b) => b.text() === "Off")!;
    expect(offBtn.classes()).toContain("bg-[var(--accent)]");
  });

  it("emits update:modelValue with mirostat=1 when Mirostat 1 clicked", async () => {
    const wrapper = mountComponent({});
    const btn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Mirostat 1")!;
    await btn.trigger("click");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect((emitted![0][0] as Partial<ChatOptions>).mirostat).toBe(1);
  });

  it("emits update:modelValue with mirostat=2 when Mirostat 2 clicked", async () => {
    const wrapper = mountComponent({});
    const btn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Mirostat 2")!;
    await btn.trigger("click");
    const emitted = wrapper.emitted("update:modelValue");
    expect((emitted![0][0] as Partial<ChatOptions>).mirostat).toBe(2);
  });

  it("emits update:modelValue with mirostat=0 when Off clicked", async () => {
    const wrapper = mountComponent({ mirostat: 2 });
    const offBtn = wrapper.findAll("button").find((b) => b.text() === "Off")!;
    await offBtn.trigger("click");
    const emitted = wrapper.emitted("update:modelValue");
    expect((emitted![0][0] as Partial<ChatOptions>).mirostat).toBe(0);
  });

  it("hides Top P and Top K sliders when mirostat is active", () => {
    const wrapper = mountComponent({ mirostat: 1 });
    // SettingsSlider renders with a label prop — find by label text in rendered output
    const html = wrapper.html();
    // Top P label should not appear
    expect(html).not.toContain("Top P");
    expect(html).not.toContain("Top K");
    // Tau and Eta labels should appear
    expect(html).toContain("Mirostat Tau");
    expect(html).toContain("Mirostat Eta");
  });

  it("shows Top P and Top K when mirostat is Off", () => {
    const wrapper = mountComponent({ mirostat: 0 });
    const html = wrapper.html();
    expect(html).toContain("Top P");
    expect(html).toContain("Top K");
    expect(html).not.toContain("Mirostat Tau");
    expect(html).not.toContain("Mirostat Eta");
  });
});

describe("AdvancedChatOptions — Seed control", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("emits update:modelValue with seed=42 when input changes to '42'", async () => {
    const wrapper = mountComponent({});
    const input = wrapper.find('input[type="number"]');
    (input.element as HTMLInputElement).value = "42";
    await input.trigger("change");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect((emitted![0][0] as Partial<ChatOptions>).seed).toBe(42);
  });

  it("emits update:modelValue with seed=undefined when input changes to ''", async () => {
    const wrapper = mountComponent({ seed: 7 });
    const input = wrapper.find('input[type="number"]');
    (input.element as HTMLInputElement).value = "";
    await input.trigger("change");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect((emitted![0][0] as Partial<ChatOptions>).seed).toBeUndefined();
  });

  it("emits update:presetId with '' when seed is changed", async () => {
    const wrapper = mountComponent({}, "my-preset");
    const input = wrapper.find('input[type="number"]');
    (input.element as HTMLInputElement).value = "99";
    await input.trigger("change");
    const emitted = wrapper.emitted("update:presetId");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toBe("");
  });

  it("reset button is visible when seed is set and calls updateSeed('')", async () => {
    const wrapper = mountComponent({ seed: 7 });
    const resetBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Reset");
    expect(resetBtn).toBeDefined();
    await resetBtn!.trigger("click");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect((emitted![0][0] as Partial<ChatOptions>).seed).toBeUndefined();
  });

  it("reset button is not rendered when seed is undefined", () => {
    const wrapper = mountComponent({});
    const resetButtons = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Reset");
    expect(resetButtons).toHaveLength(0);
  });

  it("'Set as default' button only renders when model prop is provided", () => {
    const withoutModel = mountComponent({});
    const withModel = mountComponent({}, "", "llama3:latest");
    const hasDefault = (w: ReturnType<typeof mountComponent>) =>
      w.findAll("button").some((b) => b.text().includes("Set as default"));
    expect(hasDefault(withoutModel)).toBe(false);
    expect(hasDefault(withModel)).toBe(true);
  });

  it("'Set as default' button calls set_model_defaults invoke on click", async () => {
    mockInvoke.mockResolvedValue(undefined);
    const wrapper = mountComponent({ temperature: 0.5 }, "", "llama3:latest");
    const defaultBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Set as default"))!;
    await defaultBtn.trigger("click");
    await flushPromises();
    expect(mockInvoke).toHaveBeenCalledWith(
      "set_model_defaults",
      expect.objectContaining({ modelName: "llama3:latest" }),
    );
  });
});
