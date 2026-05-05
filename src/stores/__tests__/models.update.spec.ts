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
});
