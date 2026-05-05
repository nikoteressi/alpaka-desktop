import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmationModal from "./ConfirmationModal.vue";

function mkWrapper(overrides: Record<string, unknown> = {}) {
  return mount(ConfirmationModal, {
    props: { show: true, ...overrides },
    global: {
      stubs: {
        Teleport: true,
        Transition: { template: "<div><slot /></div>" },
      },
    },
  });
}

describe("ConfirmationModal", () => {
  it("renders when show is true", () => {
    const wrapper = mkWrapper();
    expect(wrapper.text()).toContain("Confirm");
  });

  it("displays custom title", () => {
    const wrapper = mkWrapper({ title: "Delete Item?" });
    expect(wrapper.text()).toContain("Delete Item?");
  });

  it("displays custom message", () => {
    const wrapper = mkWrapper({ message: "This cannot be undone." });
    expect(wrapper.text()).toContain("This cannot be undone.");
  });

  it("displays custom confirmLabel on confirm button", () => {
    const wrapper = mkWrapper({ confirmLabel: "Yes, delete" });
    expect(wrapper.text()).toContain("Yes, delete");
  });

  it("emits confirm when confirm button is clicked", async () => {
    const wrapper = mkWrapper({ confirmLabel: "OK" });
    const buttons = wrapper.findAll("button");
    const confirmBtn = buttons.find((b) => b.text() === "OK");
    await confirmBtn?.trigger("click");
    expect(wrapper.emitted("confirm")).toBeTruthy();
  });

  it("emits cancel when cancel button is clicked", async () => {
    const wrapper = mkWrapper();
    const buttons = wrapper.findAll("button");
    const cancelBtn = buttons.find((b) => b.text() === "Cancel");
    await cancelBtn?.trigger("click");
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  it("hides cancel button when hideCancel is true", () => {
    const wrapper = mkWrapper({ hideCancel: true });
    const buttons = wrapper.findAll("button");
    const cancelBtn = buttons.find((b) => b.text() === "Cancel");
    expect(cancelBtn).toBeUndefined();
  });
});
