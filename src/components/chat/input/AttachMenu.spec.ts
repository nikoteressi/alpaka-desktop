import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import AttachMenu from "./AttachMenu.vue";

// CustomTooltip is a shared UI wrapper — stub it so it just renders its slot
const globalStubs = {
  CustomTooltip: { template: "<div><slot /></div>" },
};

describe("AttachMenu", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    expect(wrapper.exists()).toBe(true);
  });

  it("menu is closed by default", () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(false);
  });

  it("opens menu when toggle button is clicked", async () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    await wrapper.find("button[aria-label='Attach']").trigger("click");
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(true);
  });

  it("closes menu on second click (toggle)", async () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    const btn = wrapper.find("button[aria-label='Attach']");
    await btn.trigger("click");
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(true);
    await btn.trigger("click");
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(false);
  });

  it("trigger button is disabled when disabled prop is true", () => {
    const wrapper = mount(AttachMenu, {
      props: { disabled: true },
      global: { stubs: globalStubs },
    });
    const btn = wrapper.find("button[aria-label='Attach']");
    expect(btn.attributes("disabled")).toBeDefined();
  });

  it("emits 'pick-file' and closes menu when Link File Context is clicked", async () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    // Open first
    await wrapper.find("button[aria-label='Attach']").trigger("click");

    // Click the Link File Context button — it's the second button in the menu
    const menuButtons = wrapper.findAll("button").filter((b) =>
      b.text().includes("Link File Context"),
    );
    expect(menuButtons).toHaveLength(1);
    await menuButtons[0].trigger("click");

    expect(wrapper.emitted("pick-file")).toHaveLength(1);
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(false);
  });

  it("emits 'pick-folder' and closes menu when Link Folder Context is clicked", async () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    await wrapper.find("button[aria-label='Attach']").trigger("click");

    const menuButtons = wrapper.findAll("button").filter((b) =>
      b.text().includes("Link Folder Context"),
    );
    expect(menuButtons).toHaveLength(1);
    await menuButtons[0].trigger("click");

    expect(wrapper.emitted("pick-folder")).toHaveLength(1);
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(false);
  });

  it("Link File Context and Link Folder Context buttons are disabled when isLinking is true", async () => {
    const wrapper = mount(AttachMenu, {
      props: { isLinking: true },
      global: { stubs: globalStubs },
    });
    await wrapper.find("button[aria-label='Attach']").trigger("click");
    const disabledButtons = wrapper
      .findAll("button")
      .filter((b) => b.attributes("disabled") !== undefined && b.text() !== "");
    expect(disabledButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("triggerImageUpload closes menu and clicks hidden file input", async () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    // Open menu
    await wrapper.find("button[aria-label='Attach']").trigger("click");

    // Spy on the hidden input click
    const fileInput = wrapper.find('input[type="file"]');
    const clickSpy = vi.fn();
    (fileInput.element as HTMLInputElement).click = clickSpy;

    // Click "Attach Images"
    const attachImgButton = wrapper.findAll("button").find((b) =>
      b.text().includes("Attach Images"),
    );
    expect(attachImgButton).toBeDefined();
    await attachImgButton!.trigger("click");

    // Menu should be closed
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(false);
    // File input click was triggered
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("emits 'files' when the hidden file input changes with selected files", async () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    const fileInput = wrapper.find('input[type="file"]');
    const inputEl = fileInput.element as HTMLInputElement;

    const file = new File(["content"], "photo.png", { type: "image/png" });

    // vue-test-utils forbids passing `target` via trigger(); define files on the
    // element directly and dispatch the event natively.
    Object.defineProperty(inputEl, "files", {
      value: [file],
      configurable: true,
    });
    inputEl.dispatchEvent(new Event("change"));
    await nextTick();

    const emitted = wrapper.emitted("files");
    expect(emitted).toHaveLength(1);
  });

  it("does not emit 'files' when file input changes with no files selected", async () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    const fileInput = wrapper.find('input[type="file"]');
    const inputEl = fileInput.element as HTMLInputElement;

    Object.defineProperty(inputEl, "files", {
      value: [],
      configurable: true,
    });
    inputEl.dispatchEvent(new Event("change"));
    await nextTick();

    expect(wrapper.emitted("files")).toBeUndefined();
  });

  it("closes when outside click is dispatched on document", async () => {
    const wrapper = mount(AttachMenu, {
      attachTo: document.body,
      global: { stubs: globalStubs },
    });

    // Open menu
    await wrapper.find("button[aria-label='Attach']").trigger("click");
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(true);

    // Dispatch mousedown on body (outside the component)
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it("does not close when click is inside the component", async () => {
    const wrapper = mount(AttachMenu, {
      attachTo: document.body,
      global: { stubs: globalStubs },
    });

    await wrapper.find("button[aria-label='Attach']").trigger("click");
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(true);

    // Dispatch mousedown on the component's own root element (inside)
    wrapper.element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await nextTick();

    // Should remain open
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it("close() exposed method closes the menu", async () => {
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });

    // Open menu first
    await wrapper.find("button[aria-label='Attach']").trigger("click");
    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(true);

    // Call exposed close()
    (wrapper.vm as unknown as { close: () => void }).close();
    await nextTick();

    expect(wrapper.find('[class*="absolute bottom-full"]').exists()).toBe(false);
  });

  it("removes mousedown listener on unmount (no memory leak)", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const wrapper = mount(AttachMenu, { global: { stubs: globalStubs } });
    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith("mousedown", expect.any(Function));
    removeSpy.mockRestore();
  });
});
