import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useModelStore } from "./models";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

describe("models store — pushModel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("sets pushing[name] on start and clears on success", async () => {
    const store = useModelStore();
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    const pushPromise = store.pushModel("myuser/mymodel:latest");
    expect(store.pushing["myuser/mymodel:latest"]).toBeDefined();
    expect(store.pushing["myuser/mymodel:latest"].status).toBe("starting...");

    await pushPromise;
    expect(store.pushing["myuser/mymodel:latest"]).toBeUndefined();
  });

  it("clears pushing[name] on invoke error", async () => {
    const store = useModelStore();
    vi.mocked(invoke).mockRejectedValueOnce(new Error("push failed"));

    await store.pushModel("myuser/mymodel:latest").catch(() => {});
    expect(store.pushing["myuser/mymodel:latest"]).toBeUndefined();
  });

  it("does not start a second push if already pushing", async () => {
    const store = useModelStore();
    vi.mocked(invoke).mockResolvedValue(undefined);

    store.pushing["myuser/mymodel:latest"] = {
      model: "myuser/mymodel:latest",
      status: "uploading",
      percent: 50,
    };
    await store.pushModel("myuser/mymodel:latest");

    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
  });

  it("registers push event listeners in initListeners", async () => {
    const store = useModelStore();
    await store.initListeners();

    const listenCalls = vi.mocked(listen).mock.calls.map((c) => c[0]);
    expect(listenCalls).toContain("model:push-progress");
    expect(listenCalls).toContain("model:push-done");
    expect(listenCalls).toContain("model:push-error");
  });

  it("model:push-done triggers fetchModels and clears pushing entry", async () => {
    const listeners: Record<string, (e: { payload: unknown }) => void> = {};
    vi.mocked(listen).mockImplementation((event, cb) => {
      listeners[event as string] = cb as (e: { payload: unknown }) => void;
      return Promise.resolve(() => {});
    });
    vi.mocked(invoke).mockResolvedValue([]);

    const store = useModelStore();
    await store.initListeners();

    store.pushing["myuser/mymodel:latest"] = {
      model: "myuser/mymodel:latest",
      status: "uploading",
      percent: 80,
    };

    listeners["model:push-done"]({
      payload: { model: "myuser/mymodel:latest" },
    });

    expect(store.pushing["myuser/mymodel:latest"]).toBeUndefined();
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("list_models");
  });
});
