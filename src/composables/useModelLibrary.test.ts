import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { useModelLibrary } from "./useModelLibrary";

describe("useModelLibrary", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("initial state has empty results and no loading flag", () => {
    const lib = useModelLibrary();
    expect(lib.libraryResults.value).toEqual([]);
    expect(lib.isSearching.value).toBe(false);
  });

  it("fetchCloudModels sets isCloudLoading while fetching", async () => {
    let resolveInvoke!: (v: unknown) => void;
    vi.mocked(invoke).mockReturnValue(
      new Promise((r) => {
        resolveInvoke = r;
      }),
    );

    const lib = useModelLibrary();
    const promise = lib.fetchCloudModels();

    expect(lib.isCloudLoading.value).toBe(true);

    resolveInvoke([]);
    await promise;
    expect(lib.isCloudLoading.value).toBe(false);
  });
});
