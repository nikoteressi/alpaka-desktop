import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

import AdvancedChatOptions from "./AdvancedChatOptions.vue";
import type { ChatOptions } from "../../../types/settings";

function mountComponent(modelValue: Partial<ChatOptions> = {}, presetId = "") {
  return mount(AdvancedChatOptions, {
    props: { modelValue, presetId },
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
