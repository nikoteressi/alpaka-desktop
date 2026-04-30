import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useModelStore } from "./models";
import type { CreateState } from "../types/models";

// Mock Tauri
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe("models store — creating map", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with empty creating map", () => {
    const store = useModelStore();
    expect(store.creating).toEqual({});
  });

  it("clearCreateState removes the entry", () => {
    const store = useModelStore();
    const state: CreateState = {
      name: "mymodel",
      modelfile: "FROM llama3",
      status: "done",
      phase: "done",
      logLines: ["success"],
    };
    store.creating["mymodel"] = state;
    store.clearCreateState("mymodel");
    expect(store.creating["mymodel"]).toBeUndefined();
  });

  it("clearCreateState is a no-op for unknown name", () => {
    const store = useModelStore();
    expect(() => store.clearCreateState("ghost")).not.toThrow();
  });
});
