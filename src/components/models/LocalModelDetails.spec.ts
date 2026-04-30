import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import type { ModelName } from "../../types/models";
import LocalModelDetails from "./LocalModelDetails.vue";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../../composables/useAppOrchestration", () => ({
  useAppOrchestration: () => ({ startNewChat: vi.fn(), switchHost: vi.fn() }),
}));

const mockModel = {
  name: "qwen2.5-coder:14b" as ModelName,
  model: "qwen2.5-coder:14b",
  modified_at: "2024-01-01T00:00:00Z",
  size: 9_000_000_000,
  digest: "abc123",
  details: {
    parent_model: "",
    format: "gguf",
    family: "qwen2",
    families: null,
    parameter_size: "14B",
    quantization_level: "Q4_K_M",
  },
};

describe("LocalModelDetails", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("calls get_model_defaults on mount with the model name", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue({ temperature: 0.1, num_ctx: 8192 });

    mount(LocalModelDetails, {
      props: { model: mockModel },
    });

    expect(invoke).toHaveBeenCalledWith("get_model_defaults", {
      modelName: "qwen2.5-coder:14b",
    });
  });

  it("calls set_model_defaults when Save button is clicked", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(null);

    const wrapper = mount(LocalModelDetails, {
      props: { model: mockModel },
    });

    await flushPromises();
    const saveBtn = wrapper.find('[data-testid="save-defaults"]');
    await saveBtn.trigger("click");

    expect(invoke).toHaveBeenCalledWith(
      "set_model_defaults",
      expect.objectContaining({ modelName: "qwen2.5-coder:14b" }),
    );
  });

  it("reset button restores global defaults without saving", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue({ temperature: 0.1 });

    const wrapper = mount(LocalModelDetails, {
      props: { model: mockModel },
    });

    await flushPromises();
    const resetBtn = wrapper.find('[data-testid="reset-defaults"]');
    await resetBtn.trigger("click");

    // set_model_defaults should NOT have been called (reset is not auto-save)
    expect(invoke).not.toHaveBeenCalledWith(
      "set_model_defaults",
      expect.anything(),
    );
  });
});

describe("LocalModelDetails — Mirostat controls (S-08)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("renders Sampling Mode selector with Off/Mirostat1/Mirostat2 buttons", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(null);

    const wrapper = mount(LocalModelDetails, { props: { model: mockModel } });
    await flushPromises();

    const buttons = wrapper
      .findAll("button")
      .filter((b) => ["Off", "Mirostat 1", "Mirostat 2"].includes(b.text()));
    expect(buttons).toHaveLength(3);
  });

  it("clicking Mirostat 2 sets effectiveMirostat to 2", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(null);

    const wrapper = mount(LocalModelDetails, { props: { model: mockModel } });
    await flushPromises();

    const btn = wrapper
      .findAll("button")
      .find((b) => b.text() === "Mirostat 2")!;
    await btn.trigger("click");
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as { effectiveMirostat: number };
    expect(vm.effectiveMirostat).toBe(2);
  });

  it("loads mirostat defaults from stored model settings", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue({
      mirostat: 1,
      mirostat_tau: 6.0,
      mirostat_eta: 0.2,
    });

    const wrapper = mount(LocalModelDetails, { props: { model: mockModel } });
    await flushPromises();

    const vm = wrapper.vm as unknown as {
      effectiveMirostat: number;
      edited: { mirostat?: number; mirostat_tau?: number };
    };
    expect(vm.effectiveMirostat).toBe(1);
    expect(vm.edited.mirostat_tau).toBe(6.0);
  });

  it("effectiveMirostat defaults to 0 when no stored defaults", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(null);

    const wrapper = mount(LocalModelDetails, { props: { model: mockModel } });
    await flushPromises();

    const vm = wrapper.vm as unknown as { effectiveMirostat: number };
    expect(vm.effectiveMirostat).toBe(0);
  });
});
