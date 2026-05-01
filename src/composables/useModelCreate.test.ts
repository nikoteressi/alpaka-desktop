import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useModelCreate } from "./useModelCreate";
import { useModelStore } from "../stores/models";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("useModelCreate", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("start() sets creating[name] to running phase before invoke", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const store = useModelStore();
    const { start } = useModelCreate();

    const promise = start("mymodel", "FROM llama3");
    // State is set synchronously before await
    expect(store.creating["mymodel"]?.phase).toBe("running");
    expect(store.creating["mymodel"]?.modelfile).toBe("FROM llama3");
    await promise;
  });

  it("start() calls invoke with correct args", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const { start } = useModelCreate();

    await start("mymodel", 'FROM llama3\nSYSTEM "hi"');
    expect(mockInvoke).toHaveBeenCalledWith("create_model", {
      name: "mymodel",
      modelfile: 'FROM llama3\nSYSTEM "hi"',
    });
  });

  it("cancel() calls invoke cancel_model_create with name", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const { cancel } = useModelCreate();

    await cancel("mymodel");
    expect(mockInvoke).toHaveBeenCalledWith("cancel_model_create", {
      name: "mymodel",
    });
  });
});
