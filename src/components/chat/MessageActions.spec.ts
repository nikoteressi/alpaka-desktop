import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import MessageActions from "./MessageActions.vue";

const message = { role: "assistant" as const, content: "Hello world" };

describe("MessageActions — copy button", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders copy button", () => {
    const wrapper = mount(MessageActions, {
      props: { message, isUser: false },
    });
    expect(wrapper.find('[aria-label="Copy"]').exists()).toBe(true);
  });

  it("calls handleCopy when copy button is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "isSecureContext", {
      value: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const wrapper = mount(MessageActions, {
      props: { message, isUser: false },
    });

    await wrapper.find('[aria-label="Copy"]').trigger("click");
    expect(writeText).toHaveBeenCalledWith("Hello world");
  });
});

describe("MessageActions — version switcher", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows version switcher when totalVersions > 1", () => {
    const wrapper = mount(MessageActions, {
      props: {
        message,
        isUser: false,
        currentVersion: 1,
        totalVersions: 3,
      },
    });
    expect(wrapper.text()).toContain("1 / 3");
  });

  it("hides version switcher when totalVersions is 1", () => {
    const wrapper = mount(MessageActions, {
      props: { message, isUser: false, totalVersions: 1 },
    });
    expect(wrapper.find(".version-switcher").exists()).toBe(false);
  });

  it("emits prev-version when left chevron is clicked", async () => {
    const wrapper = mount(MessageActions, {
      props: { message, isUser: false, currentVersion: 2, totalVersions: 3 },
    });
    const buttons = wrapper.find(".version-switcher").findAll(".action-btn");
    await buttons[0].trigger("click");
    expect(wrapper.emitted("prev-version")).toBeTruthy();
  });
});
