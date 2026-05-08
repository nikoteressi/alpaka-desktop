import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import EditMessageModal from "./EditMessageModal.vue";

vi.mock("../shared/BaseModal.vue", () => ({
  default: {
    name: "BaseModal",
    props: ["show", "title", "maxWidth"],
    emits: ["close"],
    template: `
      <div v-if="show" data-testid="base-modal">
        <slot />
        <div data-testid="modal-footer"><slot name="footer" /></div>
      </div>
    `,
  },
}));

describe("EditMessageModal.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not render when open is false", () => {
    const wrapper = mount(EditMessageModal, {
      props: { open: false, initialContent: "hello" },
    });
    expect(wrapper.find('[data-testid="base-modal"]').exists()).toBe(false);
  });

  it("renders when open is true", async () => {
    const wrapper = mount(EditMessageModal, {
      props: { open: true, initialContent: "hello" },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="base-modal"]').exists()).toBe(true);
  });

  it("pre-fills textarea with initialContent when opened", async () => {
    const wrapper = mount(EditMessageModal, {
      props: { open: false, initialContent: "original text" },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    expect(
      (wrapper.find("textarea").element as HTMLTextAreaElement).value,
    ).toBe("original text");
  });

  it("emits cancel when BaseModal emits close", async () => {
    const wrapper = mount(EditMessageModal, {
      props: { open: true, initialContent: "hello" },
    });
    await flushPromises();
    await wrapper.findComponent({ name: "BaseModal" }).vm.$emit("close");
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  it("Cancel button emits cancel", async () => {
    const wrapper = mount(EditMessageModal, {
      props: { open: true, initialContent: "hello" },
    });
    await flushPromises();
    const buttons = wrapper.findAll("button");
    const cancelBtn = buttons.find((b) => b.text() === "Cancel");
    await cancelBtn!.trigger("click");
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  async function openModal(initialContent: string) {
    const wrapper = mount(EditMessageModal, {
      props: { open: false, initialContent },
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    return wrapper;
  }

  it("Send button is disabled when content is unchanged", async () => {
    const wrapper = await openModal("hello");
    const sendBtn = wrapper.findAll("button").find((b) => b.text() === "Send");
    expect((sendBtn!.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("Send button emits confirm with trimmed content when changed", async () => {
    const wrapper = await openModal("hello");
    await wrapper.find("textarea").setValue("  updated text  ");
    const sendBtn = wrapper.findAll("button").find((b) => b.text() === "Send");
    await sendBtn!.trigger("click");
    expect(wrapper.emitted("confirm")).toEqual([["updated text"]]);
  });

  it("Send button is disabled when content is empty", async () => {
    const wrapper = await openModal("hello");
    await wrapper.find("textarea").setValue("   ");
    const sendBtn = wrapper.findAll("button").find((b) => b.text() === "Send");
    expect((sendBtn!.element as HTMLButtonElement).disabled).toBe(true);
  });
});
