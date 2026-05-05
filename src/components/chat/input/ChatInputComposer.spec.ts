import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ChatInputComposer from "./ChatInputComposer.vue";

function mkWrapper(
  overrides: Partial<InstanceType<typeof ChatInputComposer>["$props"]> = {},
) {
  return mount(ChatInputComposer, {
    props: {
      modelValue: "",
      isStreaming: false,
      hasAttachments: false,
      ...overrides,
    },
  });
}

describe("ChatInputComposer", () => {
  it("renders a textarea", () => {
    const wrapper = mkWrapper();
    expect(wrapper.find("textarea").exists()).toBe(true);
  });

  it("textarea is disabled when isStreaming is true", () => {
    const wrapper = mkWrapper({ isStreaming: true });
    expect(wrapper.find("textarea").attributes("disabled")).toBeDefined();
  });

  it("textarea is not disabled when isStreaming is false", () => {
    const wrapper = mkWrapper({ isStreaming: false });
    expect(wrapper.find("textarea").attributes("disabled")).toBeUndefined();
  });

  it("renders send button with correct aria-label when not streaming", () => {
    const wrapper = mkWrapper();
    const btn = wrapper.find("[data-testid='send-btn']");
    expect(btn.attributes("aria-label")).toBe("Send message");
  });

  it("renders send button with stop aria-label when streaming", () => {
    const wrapper = mkWrapper({ isStreaming: true });
    const btn = wrapper.find("[data-testid='send-btn']");
    expect(btn.attributes("aria-label")).toBe("Stop generation");
  });

  it("emits update:modelValue on textarea input", async () => {
    const wrapper = mkWrapper({ modelValue: "" });
    const ta = wrapper.find("textarea");
    await ta.setValue("hello");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toBe("hello");
  });

  it("emits submit when send button is clicked while streaming", async () => {
    const wrapper = mkWrapper({ isStreaming: true });
    await wrapper.find("[data-testid='send-btn']").trigger("click");
    expect(wrapper.emitted("submit")).toBeTruthy();
  });

  it("emits submit when send button clicked with content", async () => {
    const wrapper = mkWrapper({ modelValue: "hello" });
    await wrapper.find("[data-testid='send-btn']").trigger("click");
    expect(wrapper.emitted("submit")).toBeTruthy();
  });

  it("emits keydown events from textarea", async () => {
    const wrapper = mkWrapper();
    await wrapper.find("textarea").trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("keydown")).toBeTruthy();
  });

  it("send button is disabled when no content and no attachments and not streaming", () => {
    const wrapper = mkWrapper({
      modelValue: "",
      hasAttachments: false,
      isStreaming: false,
    });
    const btn = wrapper.find("[data-testid='send-btn']");
    expect(btn.attributes("disabled")).toBeDefined();
  });

  it("send button is enabled when hasAttachments is true", () => {
    const wrapper = mkWrapper({
      modelValue: "",
      hasAttachments: true,
      isStreaming: false,
    });
    const btn = wrapper.find("[data-testid='send-btn']");
    expect(btn.attributes("disabled")).toBeUndefined();
  });
});
