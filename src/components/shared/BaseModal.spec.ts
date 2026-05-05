import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseModal from "./BaseModal.vue";

function mkWrapper(show = true, overrides: Record<string, unknown> = {}) {
  return mount(BaseModal, {
    props: { show, ...overrides },
    global: {
      stubs: {
        Teleport: true,
        Transition: { template: "<div><slot /></div>" },
      },
    },
    slots: { default: "<p>Modal body</p>" },
  });
}

describe("BaseModal", () => {
  it("renders body slot when show is true", () => {
    const wrapper = mkWrapper(true);
    expect(wrapper.text()).toContain("Modal body");
  });

  it("does not render when show is false", () => {
    const wrapper = mkWrapper(false);
    expect(wrapper.text()).not.toContain("Modal body");
  });

  it("renders title when provided", () => {
    const wrapper = mkWrapper(true, { title: "My Dialog" });
    expect(wrapper.text()).toContain("My Dialog");
  });

  it("emits close when close button is clicked", async () => {
    const wrapper = mkWrapper(true, { title: "X", showClose: true });
    await wrapper.find("button").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
