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

  it("doSearch clears results and returns early when query is shorter than 2 chars", async () => {
    const lib = useModelLibrary();
    lib.libraryResults.value = [
      { name: "old", description: "", tags: [], pulls: 0, updated: "" },
    ];
    await lib.doSearch("a");
    expect(lib.libraryResults.value).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("doSearch populates libraryResults on success", async () => {
    const results = [
      { name: "llama3", description: "", tags: [], pulls: 0, updated: "" },
    ];
    vi.mocked(invoke).mockResolvedValue(results);

    const lib = useModelLibrary();
    await lib.doSearch("llama");

    expect(lib.libraryResults.value).toEqual(results);
    expect(lib.isSearching.value).toBe(false);
  });

  it("doSearch clears results and logs warning on non-abort error", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("timeout"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const lib = useModelLibrary();
    await lib.doSearch("llama");

    expect(lib.libraryResults.value).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("scheduleSearch debounces calls and eventually calls doSearch", async () => {
    vi.useFakeTimers();
    vi.mocked(invoke).mockResolvedValue([]);

    const lib = useModelLibrary();
    lib.scheduleSearch("llama", undefined, 200);
    expect(invoke).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    await Promise.resolve();

    expect(invoke).toHaveBeenCalled();
    vi.useRealTimers();
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

  it("fetchCloudModels logs warning and clears dynamicCloudModels on error", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("network"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const lib = useModelLibrary();
    await lib.fetchCloudModels();

    expect(lib.dynamicCloudModels.value).toEqual([]);
    expect(lib.isCloudLoading.value).toBe(false);
    warn.mockRestore();
  });

  it("detectHardware populates hardware ref on success", async () => {
    const hw = { gpu: "RTX 4090", vram_mb: 24576, ram_mb: 65536 };
    vi.mocked(invoke).mockResolvedValue(hw);

    const lib = useModelLibrary();
    await lib.detectHardware();

    expect(lib.hardware.value).toEqual(hw);
  });

  it("detectHardware logs warning and leaves hardware null on error", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("not supported"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const lib = useModelLibrary();
    await lib.detectHardware();

    expect(lib.hardware.value).toBeNull();
    warn.mockRestore();
  });

  it("cancelSearch aborts active search and clears debounce timer", async () => {
    vi.useFakeTimers();
    vi.mocked(invoke).mockResolvedValue([]);

    const lib = useModelLibrary();
    lib.scheduleSearch("llama", undefined, 500);
    lib.cancelSearch();

    vi.advanceTimersByTime(500);
    await Promise.resolve();

    expect(invoke).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
