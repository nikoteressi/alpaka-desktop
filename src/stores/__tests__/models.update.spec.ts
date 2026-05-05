import { setActivePinia, createPinia } from "pinia";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useModelStore } from "../models";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

import { invoke } from "@tauri-apps/api/core";

describe("model update state", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("modelsWithUpdates is empty by default", () => {
    const store = useModelStore();
    expect(store.modelsWithUpdates.size).toBe(0);
    expect(store.updatesAvailableCount).toBe(0);
  });

  it("hasUpdate returns false for unknown model", () => {
    const store = useModelStore();
    expect(store.hasUpdate("llama3:8b")).toBe(false);
  });

  it("fetchInitialUpdateStatus populates modelsWithUpdates", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(["llama3:8b", "mistral"]);
    const store = useModelStore();
    await store.fetchInitialUpdateStatus();
    expect(store.modelsWithUpdates.has("llama3:8b")).toBe(true);
    expect(store.modelsWithUpdates.has("mistral")).toBe(true);
    expect(store.updatesAvailableCount).toBe(2);
    expect(store.hasUpdate("llama3:8b")).toBe(true);
  });

  it("fetchInitialUpdateStatus handles invoke failure gracefully", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("network error"));
    const store = useModelStore();
    await store.fetchInitialUpdateStatus();
    expect(store.modelsWithUpdates.size).toBe(0);
  });

  it("modelsWithUpdates can be updated via Set assignment", () => {
    const store = useModelStore();
    store.modelsWithUpdates = new Set(["phi3", "gemma"]);
    expect(store.hasUpdate("phi3")).toBe(true);
    expect(store.hasUpdate("llama3")).toBe(false);
    expect(store.updatesAvailableCount).toBe(2);
  });

  it("isCheckingUpdates starts false", () => {
    const store = useModelStore();
    expect(store.isCheckingUpdates).toBe(false);
  });

  it("triggerUpdateCheck sets isCheckingUpdates true while running", async () => {
    let resolve!: () => void;
    vi.mocked(invoke).mockImplementationOnce(
      () => new Promise<void>((r) => (resolve = r)),
    );
    const store = useModelStore();
    const promise = store.triggerUpdateCheck();
    expect(store.isCheckingUpdates).toBe(true);
    resolve();
    await promise;
  });

  it("triggerUpdateCheck resets isCheckingUpdates on invoke failure", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("fail"));
    const store = useModelStore();
    await store.triggerUpdateCheck();
    expect(store.isCheckingUpdates).toBe(false);
  });

  it("triggerUpdateCheck is a no-op when already checking", async () => {
    let resolve!: () => void;
    vi.mocked(invoke).mockImplementationOnce(
      () => new Promise<void>((r) => (resolve = r)),
    );
    const store = useModelStore();
    vi.mocked(invoke).mockClear();
    store.triggerUpdateCheck(); // don't await — leave it running
    expect(store.isCheckingUpdates).toBe(true);
    await store.triggerUpdateCheck(); // second call should return immediately
    expect(vi.mocked(invoke)).toHaveBeenCalledTimes(1); // only the first call hit invoke
    resolve();
  });
});
