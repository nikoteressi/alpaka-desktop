import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import GpuLayersSettings from "./GpuLayersSettings.vue";
import { useSettingsStore } from "../../stores/settings";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) =>
    mockInvoke(cmd, args),
}));

function mountComponent() {
  return mount(GpuLayersSettings);
}

describe("GpuLayersSettings", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({
      ram_mb: 16384,
      gpu_name: "RX 6800",
      vram_mb: 16384,
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the GPU Layers heading", async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("GPU Layers");
  });

  it("calls detect_hardware on mount", async () => {
    mountComponent();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockInvoke).toHaveBeenCalledWith("detect_hardware", undefined);
  });

  it("shows GPU name after hardware detection", async () => {
    const wrapper = mountComponent();
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("RX 6800");
  });

  it("shows VRAM info after hardware detection", async () => {
    const wrapper = mountComponent();
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("16.0 GB VRAM");
  });

  it("shows 'No GPU detected' when gpu_name is absent", async () => {
    mockInvoke.mockResolvedValue({
      ram_mb: 16384,
      gpu_name: undefined,
      vram_mb: undefined,
    });
    const wrapper = mountComponent();
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("No GPU detected");
  });

  it("number input reflects store num_gpu value", async () => {
    const store = useSettingsStore();
    store.chatOptions = { ...store.chatOptions, num_gpu: 20 };

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const input = wrapper.find("input[type='number']");
    expect((input.element as HTMLInputElement).value).toBe("20");
  });

  it("displays 'All layers (auto)' when num_gpu is -1", async () => {
    const store = useSettingsStore();
    store.chatOptions = { ...store.chatOptions, num_gpu: -1 };

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("All layers");
  });

  it("displays 'CPU only' when num_gpu is 0", async () => {
    const store = useSettingsStore();
    store.chatOptions = { ...store.chatOptions, num_gpu: 0 };

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("CPU only");
  });

  it("displays 'N layers on GPU' for positive num_gpu", async () => {
    const store = useSettingsStore();
    store.chatOptions = { ...store.chatOptions, num_gpu: 15 };

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("15 layers on GPU");
  });

  it("changing input calls updateChatOptions", async () => {
    mockInvoke.mockResolvedValue(undefined);
    const store = useSettingsStore();
    const spy = vi.spyOn(store, "updateChatOptions").mockResolvedValue();

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const input = wrapper.find("input[type='number']");
    await input.setValue("10");
    await input.trigger("change");

    expect(spy).toHaveBeenCalledWith({ num_gpu: 10 });
  });

  it("clamps input value to minimum of -1", async () => {
    mockInvoke.mockResolvedValue(undefined);
    const store = useSettingsStore();
    const spy = vi.spyOn(store, "updateChatOptions").mockResolvedValue();

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const input = wrapper.find("input[type='number']");
    await input.setValue("-5");
    await input.trigger("change");

    expect(spy).toHaveBeenCalledWith({ num_gpu: -1 });
  });
});
