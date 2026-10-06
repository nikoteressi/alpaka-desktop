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

  it("emits update:modelValue on textarea input", async () => {
    const wrapper = mkWrapper({ modelValue: "" });
    const ta = wrapper.find("textarea");
    await ta.setValue("hello");
    const emitted = wrapper.emitted("update:modelValue");
    expect(emitted).toBeTruthy();
    expect(emitted![0][0]).toBe("hello");
  });

  it("emits keydown events from textarea", async () => {
    const wrapper = mkWrapper();
    await wrapper.find("textarea").trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("keydown")).toBeTruthy();
  });
});
