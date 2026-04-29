import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("useModelDefaults", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("returns stored defaults when get_model_defaults resolves a value", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue({
      temperature: 0.1,
      top_p: 0.95,
      num_ctx: 8192,
    });

    const { useModelDefaults } = await import("./useModelDefaults");
    const { applyModelDefaults } = useModelDefaults();
    const result = await applyModelDefaults("qwen2.5-coder:14b");

    expect(invoke).toHaveBeenCalledWith("get_model_defaults", {
      modelName: "qwen2.5-coder:14b",
    });
    expect(result.temperature).toBe(0.1);
    expect(result.num_ctx).toBe(8192);
  });

  it("returns global chatOptions when get_model_defaults resolves null", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(null);

    const { useModelDefaults } = await import("./useModelDefaults");
    const { applyModelDefaults } = useModelDefaults();
    const result = await applyModelDefaults("llama3");

    expect(result).toBeDefined();
    expect(typeof result.temperature).toBe("number");
  });

  it("saveAsModelDefault invokes set_model_defaults with correct payload", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(undefined);

    const { useModelDefaults } = await import("./useModelDefaults");
    const { saveAsModelDefault } = useModelDefaults();
    const options = { temperature: 0.2, top_k: 20, num_ctx: 4096 };
    await saveAsModelDefault("llama3", options);

    expect(invoke).toHaveBeenCalledWith("set_model_defaults", {
      modelName: "llama3",
      defaults: options,
    });
  });
});
