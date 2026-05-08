import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import CustomTooltip from "./CustomTooltip.vue";

function mkWrapper(
  props: {
    text: string;
    onlyIfTruncated?: boolean;
    wrapperClass?: string;
  } = { text: "tip" },
) {
  return mount(CustomTooltip, {
    props,
    slots: { default: "<span class='truncate'>content</span>" },
    attachTo: document.body,
    global: { stubs: { Transition: { template: "<slot />" } } },
  });
}

function getTooltip(): HTMLElement | null {
  return document.querySelector("[class*='fixed'][class*='z-']");
}

describe("CustomTooltip", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 768,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    document.querySelectorAll("[class*='fixed']").forEach((el) => el.remove());
  });

  it("tooltip is hidden initially", () => {
    const wrapper = mkWrapper();
    expect(getTooltip()).toBeNull();
    wrapper.unmount();
  });

  it("shows tooltip on mouseenter with correct text", async () => {
    const wrapper = mkWrapper();
    const trigger = wrapper.find("div");

    vi.spyOn(trigger.element, "getBoundingClientRect").mockReturnValue({
      left: 100,
      bottom: 200,
      top: 180,
      right: 200,
      width: 100,
      height: 20,
      x: 100,
      y: 180,
      toJSON: () => ({}),
    });

    await trigger.trigger("mouseenter");
    await wrapper.vm.$nextTick();

    const tooltip = getTooltip();
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent?.trim()).toBe("tip");
    wrapper.unmount();
  });

  it("hides tooltip on mouseleave", async () => {
    const wrapper = mkWrapper();
    const trigger = wrapper.find("div");

    vi.spyOn(trigger.element, "getBoundingClientRect").mockReturnValue({
      left: 100,
      bottom: 200,
      top: 180,
      right: 200,
      width: 100,
      height: 20,
      x: 100,
      y: 180,
      toJSON: () => ({}),
    });

    await trigger.trigger("mouseenter");
    await wrapper.vm.$nextTick();
    expect(getTooltip()).not.toBeNull();

    await trigger.trigger("mouseleave");
    await wrapper.vm.$nextTick();
    expect(getTooltip()).toBeNull();
    wrapper.unmount();
  });

  it("clamps x when tooltip would overflow the right edge", async () => {
    window.innerWidth = 350;
    const wrapper = mkWrapper();
    const trigger = wrapper.find("div");

    vi.spyOn(trigger.element, "getBoundingClientRect").mockReturnValue({
      left: 200,
      bottom: 100,
      top: 80,
      right: 300,
      width: 100,
      height: 20,
      x: 200,
      y: 80,
      toJSON: () => ({}),
    });

    await trigger.trigger("mouseenter");
    await wrapper.vm.$nextTick();

    const tooltip = getTooltip() as HTMLElement;
    expect(tooltip).not.toBeNull();
    const left = parseInt(tooltip.style.left);
    expect(left).toBeLessThan(200);
    wrapper.unmount();
  });

  it("flips above trigger when tooltip would overflow the bottom of the viewport", async () => {
    window.innerHeight = 220;
    const wrapper = mkWrapper();
    const trigger = wrapper.find("div");

    vi.spyOn(trigger.element, "getBoundingClientRect").mockReturnValue({
      left: 50,
      bottom: 200,
      top: 180,
      right: 150,
      width: 100,
      height: 20,
      x: 50,
      y: 180,
      toJSON: () => ({}),
    });

    await trigger.trigger("mouseenter");
    await wrapper.vm.$nextTick();

    const tooltip = getTooltip() as HTMLElement;
    expect(tooltip).not.toBeNull();
    const top = parseInt(tooltip.style.top);
    expect(top).toBeLessThan(180);
    wrapper.unmount();
  });

  it("skips tooltip when onlyIfTruncated=true and text is not truncated (scrollWidth <= offsetWidth)", async () => {
    const wrapper = mount(CustomTooltip, {
      props: { text: "tip", onlyIfTruncated: true },
      slots: { default: "<span class='truncate'>short</span>" },
      attachTo: document.body,
      global: { stubs: { Transition: { template: "<slot />" } } },
    });
    const trigger = wrapper.find("div");

    vi.spyOn(trigger.element, "getBoundingClientRect").mockReturnValue({
      left: 50,
      bottom: 100,
      top: 80,
      right: 150,
      width: 100,
      height: 20,
      x: 50,
      y: 80,
      toJSON: () => ({}),
    });

    // jsdom returns 0 for both scrollWidth and offsetWidth — so not truncated
    await trigger.trigger("mouseenter");
    await wrapper.vm.$nextTick();
    expect(getTooltip()).toBeNull();
    wrapper.unmount();
  });

  it("shows tooltip when onlyIfTruncated=true and text IS truncated (scrollWidth > offsetWidth)", async () => {
    const wrapper = mount(CustomTooltip, {
      props: { text: "tip", onlyIfTruncated: true },
      slots: { default: "<span class='truncate'>very long text here</span>" },
      attachTo: document.body,
      global: { stubs: { Transition: { template: "<slot />" } } },
    });
    const trigger = wrapper.find("div");
    const inner = trigger.find(".truncate").element as HTMLElement;

    Object.defineProperty(inner, "scrollWidth", {
      value: 200,
      configurable: true,
    });
    Object.defineProperty(inner, "offsetWidth", {
      value: 80,
      configurable: true,
    });

    vi.spyOn(trigger.element, "getBoundingClientRect").mockReturnValue({
      left: 50,
      bottom: 100,
      top: 80,
      right: 150,
      width: 100,
      height: 20,
      x: 50,
      y: 80,
      toJSON: () => ({}),
    });

    await trigger.trigger("mouseenter");
    await wrapper.vm.$nextTick();
    expect(getTooltip()).not.toBeNull();
    wrapper.unmount();
  });
});
