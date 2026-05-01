import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StopSequencesInput from "./StopSequencesInput.vue";

function mkWrapper(modelValue: string[] = []) {
  return mount(StopSequencesInput, { props: { modelValue } });
}

describe("StopSequencesInput", () => {
  it("renders existing sequences as tags", () => {
    const wrapper = mkWrapper(["###", "<END>"]);
    const tags = wrapper.findAll("span.font-mono");
    expect(tags).toHaveLength(2);
    expect(tags[0].text()).toContain("###");
    expect(tags[1].text()).toContain("<END>");
  });

  it("shows counter with correct fraction", () => {
    const wrapper = mkWrapper(["a", "b"]);
    expect(wrapper.text()).toContain("2/4");
  });

  it("emits update:modelValue with new sequence on Enter", async () => {
    const wrapper = mkWrapper(["a"]);
    const input = wrapper.find("input");
    await input.setValue("newseq");
    await input.trigger("keydown.enter");

    expect(wrapper.emitted("update:modelValue")).toBeTruthy();
    expect(wrapper.emitted("update:modelValue")![0][0]).toEqual([
      "a",
      "newseq",
    ]);
  });

  it("trims whitespace before adding", async () => {
    const wrapper = mkWrapper([]);
    const input = wrapper.find("input");
    await input.setValue("  padded  ");
    await input.trigger("keydown.enter");

    expect(wrapper.emitted("update:modelValue")![0][0]).toEqual(["padded"]);
  });

  it("does not emit when input is blank", async () => {
    const wrapper = mkWrapper([]);
    const input = wrapper.find("input");
    await input.setValue("   ");
    await input.trigger("keydown.enter");

    expect(wrapper.emitted("update:modelValue")).toBeFalsy();
  });

  it("does not emit duplicate sequences but clears the input", async () => {
    const wrapper = mkWrapper(["###"]);
    const input = wrapper.find("input");
    await input.setValue("###");
    await input.trigger("keydown.enter");

    expect(wrapper.emitted("update:modelValue")).toBeFalsy();
    expect((input.element as HTMLInputElement).value).toBe("");
  });

  it("removes a sequence when its × button is clicked", async () => {
    const wrapper = mkWrapper(["a", "b", "c"]);
    const removeButtons = wrapper.findAll(
      "button[aria-label='Remove stop sequence']",
    );
    await removeButtons[1].trigger("click");

    expect(wrapper.emitted("update:modelValue")![0][0]).toEqual(["a", "c"]);
  });

  it("disables input and shows limit placeholder when at max (4)", () => {
    const wrapper = mkWrapper(["a", "b", "c", "d"]);
    const input = wrapper.find("input");
    expect((input.element as HTMLInputElement).disabled).toBe(true);
    expect((input.element as HTMLInputElement).placeholder).toContain(
      "Limit reached",
    );
  });

  it("does not emit when at limit and Enter is pressed", async () => {
    const wrapper = mkWrapper(["a", "b", "c", "d"]);
    const input = wrapper.find("input");
    await input.setValue("e");
    await input.trigger("keydown.enter");

    expect(wrapper.emitted("update:modelValue")).toBeFalsy();
  });

  it("Tab key commits a non-empty draft", async () => {
    const wrapper = mkWrapper([]);
    const input = wrapper.find("input");
    await input.setValue("tabseq");
    await input.trigger("keydown", { key: "Tab" });

    expect(wrapper.emitted("update:modelValue")![0][0]).toEqual(["tabseq"]);
  });

  it("Tab key does nothing when draft is empty", async () => {
    const wrapper = mkWrapper([]);
    const input = wrapper.find("input");
    await input.setValue("");
    await input.trigger("keydown", { key: "Tab" });

    expect(wrapper.emitted("update:modelValue")).toBeFalsy();
  });
});
