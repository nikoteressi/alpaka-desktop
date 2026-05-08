import { mount } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import FolderFilePickerModal from "./FolderFilePickerModal.vue";

// Mock BaseModal to avoid Teleport-to-body issues in jsdom/happy-dom
vi.mock("../../shared/BaseModal.vue", () => ({
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

// Mock tauriApi
vi.mock("../../../lib/tauri", () => ({
  tauriApi: {
    listFolderFiles: vi.fn(),
    updateIncludedFiles: vi.fn(),
  },
}));

import { tauriApi } from "../../../lib/tauri";

const defaultProps = {
  show: true,
  contextId: "ctx-1",
  contextName: "my-project",
  contextPath: "/home/user/my-project",
  includedFiles: undefined as string[] | undefined,
  autoRefresh: false,
};

describe("FolderFilePickerModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (tauriApi.listFolderFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      "src/main.rs",
      "src/lib.rs",
      "Cargo.toml",
    ]);
  });

  it("loads files on mount and checks all when includedFiles is undefined", async () => {
    const wrapper = mount(FolderFilePickerModal, { props: defaultProps });
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(tauriApi.listFolderFiles).toHaveBeenCalledWith(
      "/home/user/my-project",
    );
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(3);
    checkboxes.forEach((cb) =>
      expect((cb.element as HTMLInputElement).checked).toBe(true),
    );
  });

  it("pre-checks only includedFiles when provided", async () => {
    const wrapper = mount(FolderFilePickerModal, {
      props: { ...defaultProps, includedFiles: ["src/main.rs"] },
    });
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    const checked = checkboxes.filter(
      (cb) => (cb.element as HTMLInputElement).checked,
    );
    expect(checked.length).toBe(1);
  });

  it("shows Apply button when at least one file is selected", async () => {
    const wrapper = mount(FolderFilePickerModal, { props: defaultProps });
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="btn-apply"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-remove"]').exists()).toBe(false);
  });

  it("shows Remove folder link button when no files are selected", async () => {
    const wrapper = mount(FolderFilePickerModal, { props: defaultProps });
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    // Uncheck all
    for (const cb of wrapper.findAll('input[type="checkbox"]')) {
      await cb.setValue(false);
    }
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="btn-remove"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="btn-apply"]').exists()).toBe(false);
  });

  it("emits apply with selected files, token estimate, and content on Apply click", async () => {
    (
      tauriApi.updateIncludedFiles as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      token_estimate: 200,
      content: "file content here",
    });

    const wrapper = mount(FolderFilePickerModal, {
      props: { ...defaultProps, includedFiles: ["src/main.rs"] },
    });
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="btn-apply"]').trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(tauriApi.updateIncludedFiles).toHaveBeenCalledWith("ctx-1", [
      "src/main.rs",
    ]);
    expect(wrapper.emitted("apply")).toBeTruthy();
    expect(wrapper.emitted("apply")![0]).toEqual([
      ["src/main.rs"],
      200,
      "file content here",
    ]);
  });

  it("emits detach when all unchecked and Remove folder link clicked", async () => {
    const wrapper = mount(FolderFilePickerModal, { props: defaultProps });
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    // Uncheck all
    for (const cb of wrapper.findAll('input[type="checkbox"]')) {
      await cb.setValue(false);
    }
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="btn-remove"]').trigger("click");
    expect(wrapper.emitted("detach")).toBeTruthy();
  });

  it("emits close on Cancel click without calling updateIncludedFiles", async () => {
    const wrapper = mount(FolderFilePickerModal, { props: defaultProps });
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="btn-cancel"]').trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
    expect(tauriApi.updateIncludedFiles).not.toHaveBeenCalled();
  });

  describe("auto-refresh toggle", () => {
    it("renders toggle with correct initial state (off)", () => {
      const wrapper = mount(FolderFilePickerModal, {
        props: { ...defaultProps, autoRefresh: false },
      });
      const toggle = wrapper.find('[role="switch"]');
      expect(toggle.exists()).toBe(true);
      expect(toggle.attributes("aria-checked")).toBe("false");
    });

    it("renders toggle with correct initial state (on)", () => {
      const wrapper = mount(FolderFilePickerModal, {
        props: { ...defaultProps, autoRefresh: true },
      });
      const toggle = wrapper.find('[role="switch"]');
      expect(toggle.attributes("aria-checked")).toBe("true");
    });

    it("emits update-auto-refresh with toggled value on click", async () => {
      const wrapper = mount(FolderFilePickerModal, {
        props: { ...defaultProps, autoRefresh: false },
      });
      await wrapper.find('[role="switch"]').trigger("click");
      expect(wrapper.emitted("update-auto-refresh")?.[0]).toEqual([true]);
    });
  });

  it("shows error message and retry button when listFolderFiles fails", async () => {
    (tauriApi.listFolderFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Permission denied"),
    );

    const wrapper = mount(FolderFilePickerModal, { props: defaultProps });
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Permission denied");
    const retryBtn = wrapper.find("button");
    expect(retryBtn.exists()).toBe(true);

    // Retry re-calls listFolderFiles
    (tauriApi.listFolderFiles as ReturnType<typeof vi.fn>).mockResolvedValue([
      "a.rs",
    ]);
    await retryBtn.trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(tauriApi.listFolderFiles).toHaveBeenCalledTimes(2);
  });
});
