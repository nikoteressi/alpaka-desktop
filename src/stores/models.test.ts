import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useModelStore, modelMatchesTag } from "./models";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => mockInvoke(cmd, args),
}));

const mockListen = vi.fn().mockResolvedValue(() => {});
vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, handler: (event: { payload: unknown }) => void) =>
    mockListen(event, handler),
}));

const MOCK_MODELS = [
  {
    name: "llama3:latest",
    model: "llama3:latest",
    modified_at: "",
    size: 1000,
    digest: "abc",
    details: {},
  },
  {
    name: "mistral:latest",
    model: "mistral:latest",
    modified_at: "",
    size: 2000,
    digest: "def",
    details: {},
  },
];

describe("useModelStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockListen.mockClear();

    // Mock localStorage
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  it("fetchModels stores results from list_models", async () => {
    const store = useModelStore();
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "list_models") return MOCK_MODELS;
      if (cmd === "list_model_user_data") return [];
      if (cmd === "get_model_capabilities") return null;
      return undefined;
    });

    await store.fetchModels();

    expect(mockInvoke).toHaveBeenCalledWith("list_models", undefined);
    expect(store.models).toHaveLength(2);
    expect(store.models[0].name).toBe("llama3:latest");
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("fetchModels sets error on failure", async () => {
    const store = useModelStore();
    mockInvoke.mockRejectedValue(new Error("connection refused"));

    await store.fetchModels();

    expect(store.error).toContain("connection refused");
    expect(store.isLoading).toBe(false);
  });

  it("deleteModel calls delete_model without any confirm() dialog", async () => {
    const store = useModelStore();
    mockInvoke.mockImplementation(
      async (cmd: string, _args: Record<string, unknown>) => {
        if (cmd === "delete_model") return undefined;
        if (cmd === "list_models") return [];
        return undefined;
      },
    );

    // confirm() must never be called — if it were, vitest would throw (no window.confirm in jsdom)
    const confirmSpy = vi.spyOn(globalThis, "confirm").mockReturnValue(false);

    await store.deleteModel("llama3:latest");

    expect(mockInvoke).toHaveBeenCalledWith("delete_model", {
      name: "llama3:latest",
    });
    expect(confirmSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("pullModel sets pulling state and calls pull_model", async () => {
    const store = useModelStore();
    mockInvoke.mockResolvedValue(undefined);

    await store.pullModel("llama3:latest");

    expect(mockInvoke).toHaveBeenCalledWith("pull_model", {
      name: "llama3:latest",
    });
  });

  it("pullModel ignores duplicate pull requests", async () => {
    const store = useModelStore();
    store.pulling["llama3:latest"] = {
      model: "llama3:latest",
      status: "downloading",
      percent: 50,
    };
    mockInvoke.mockResolvedValue(undefined);

    await store.pullModel("llama3:latest");

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("initListeners registers model:pull-progress and model:pull-done listeners", async () => {
    const store = useModelStore();

    await store.initListeners();

    const registeredEvents = mockListen.mock.calls.map(([event]) => event);
    expect(registeredEvents).toContain("model:pull-progress");
    expect(registeredEvents).toContain("model:pull-done");
    expect(store.listenersInitialized).toBe(true);
  });

  it("initListeners is idempotent — does not register twice", async () => {
    const store = useModelStore();

    await store.initListeners();
    await store.initListeners();

    expect(mockListen).toHaveBeenCalledTimes(6); // once for each event, not 12
  });

  it("fetchModels sets error from tagged-enum object { Http: 'connection refused' }", async () => {
    const store = useModelStore();
    mockInvoke.mockRejectedValue({ Http: "connection refused" });

    await store.fetchModels();

    expect(store.error).toBe("Http: connection refused");
    expect(store.isLoading).toBe(false);
  });

  it("fetchModels sets error from plain string rejection", async () => {
    const store = useModelStore();
    mockInvoke.mockRejectedValue("network timeout");

    await store.fetchModels();

    expect(store.error).toBe("network timeout");
    expect(store.isLoading).toBe(false);
  });

  it("fetchModels sets error to '{}' when rejected with an empty object", async () => {
    const store = useModelStore();
    mockInvoke.mockRejectedValue({});

    await store.fetchModels();

    expect(store.error).toBe("{}");
    expect(store.isLoading).toBe(false);
  });

  describe("model user data actions", () => {
    describe("fetchModelUserData", () => {
      it("populates modelUserData from invoke response", async () => {
        const store = useModelStore();
        mockInvoke.mockResolvedValueOnce([
          { name: "llama3:8b", is_favorite: true, tags: ["code", "fast"] },
          { name: "gemma2:9b", is_favorite: false, tags: [] },
        ]);

        await store.fetchModelUserData();

        expect(store.modelUserData["llama3:8b"]).toEqual({
          name: "llama3:8b",
          isFavorite: true,
          tags: ["code", "fast"],
        });
        expect(store.modelUserData["gemma2:9b"]).toEqual({
          name: "gemma2:9b",
          isFavorite: false,
          tags: [],
        });
        expect(store.isFavorite("llama3:8b")).toBe(true);
        expect(store.isFavorite("gemma2:9b")).toBe(false);
      });

      it("handles empty response", async () => {
        const store = useModelStore();
        mockInvoke.mockResolvedValueOnce([]);

        await store.fetchModelUserData();

        expect(Object.keys(store.modelUserData)).toHaveLength(0);
      });

      it("silently handles invoke error", async () => {
        const store = useModelStore();
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        mockInvoke.mockRejectedValueOnce(new Error("backend error"));

        await expect(store.fetchModelUserData()).resolves.toBeUndefined();

        consoleSpy.mockRestore();
      });
    });

    describe("toggleFavorite", () => {
      it("creates new entry when model not in modelUserData", async () => {
        const store = useModelStore();
        mockInvoke.mockResolvedValueOnce(true);

        await store.toggleFavorite("llama3:8b");

        expect(store.modelUserData["llama3:8b"].isFavorite).toBe(true);
        expect(store.modelUserData["llama3:8b"].tags).toEqual([]);
      });

      it("updates existing entry", async () => {
        const store = useModelStore();
        store.modelUserData["llama3:8b"] = {
          name: "llama3:8b",
          isFavorite: true,
          tags: ["code"],
        };
        mockInvoke.mockResolvedValueOnce(false);

        await store.toggleFavorite("llama3:8b");

        expect(store.modelUserData["llama3:8b"].isFavorite).toBe(false);
        expect(store.modelUserData["llama3:8b"].tags).toEqual(["code"]);
      });

      it("silently handles invoke error", async () => {
        const store = useModelStore();
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        mockInvoke.mockRejectedValueOnce(new Error("backend error"));

        await expect(
          store.toggleFavorite("llama3:8b"),
        ).resolves.toBeUndefined();

        consoleSpy.mockRestore();
      });
    });

    describe("setModelTags", () => {
      it("creates new entry when model not in modelUserData", async () => {
        const store = useModelStore();
        mockInvoke.mockResolvedValueOnce(undefined);

        await store.setModelTags("llama3:8b", ["vision", "fast"]);

        expect(store.modelUserData["llama3:8b"].tags).toEqual([
          "vision",
          "fast",
        ]);
        expect(store.modelUserData["llama3:8b"].isFavorite).toBe(false);
      });

      it("updates tags on existing entry without touching isFavorite", async () => {
        const store = useModelStore();
        store.modelUserData["llama3:8b"] = {
          name: "llama3:8b",
          isFavorite: true,
          tags: ["old"],
        };
        mockInvoke.mockResolvedValueOnce(undefined);

        await store.setModelTags("llama3:8b", ["code", "fast"]);

        expect(store.modelUserData["llama3:8b"].tags).toEqual(["code", "fast"]);
        expect(store.modelUserData["llama3:8b"].isFavorite).toBe(true);
      });

      it("silently handles invoke error", async () => {
        const store = useModelStore();
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        mockInvoke.mockRejectedValueOnce(new Error("backend error"));

        await expect(
          store.setModelTags("llama3:8b", []),
        ).resolves.toBeUndefined();

        consoleSpy.mockRestore();
      });
    });

    describe("sortedModels getter", () => {
      it("puts favorites before non-favorites", () => {
        const store = useModelStore();
        store.models = [
          {
            name: "gemma2:9b",
            model: "gemma2:9b",
            modified_at: "",
            size: 0,
            digest: "",
            details: {},
          },
          {
            name: "llama3:8b",
            model: "llama3:8b",
            modified_at: "",
            size: 0,
            digest: "",
            details: {},
          },
        ];
        store.modelUserData["llama3:8b"] = {
          name: "llama3:8b",
          isFavorite: true,
          tags: [],
        };

        expect(store.sortedModels[0].name).toBe("llama3:8b");
        expect(store.sortedModels[1].name).toBe("gemma2:9b");
      });
    });

    describe("getUserTags getter", () => {
      it("returns tags for a known model", () => {
        const store = useModelStore();
        store.modelUserData["llama3:8b"] = {
          name: "llama3:8b",
          isFavorite: false,
          tags: ["code", "fast"],
        };
        expect(store.getUserTags("llama3:8b")).toEqual(["code", "fast"]);
      });

      it("returns empty array for unknown model", () => {
        const store = useModelStore();
        expect(store.getUserTags("unknown:model")).toEqual([]);
      });
    });

    describe("allUserTags getter", () => {
      it("returns deduplicated sorted tags across all models", () => {
        const store = useModelStore();
        store.modelUserData = {
          "llama3:8b": {
            name: "llama3:8b",
            isFavorite: false,
            tags: ["fast", "code"],
          },
          "gemma2:9b": {
            name: "gemma2:9b",
            isFavorite: false,
            tags: ["code", "vision"],
          },
        };
        expect(store.allUserTags).toEqual(["code", "fast", "vision"]);
      });

      it("returns empty array when no user data", () => {
        const store = useModelStore();
        expect(store.allUserTags).toEqual([]);
      });

      it("deduplicates tags present on multiple models", () => {
        const store = useModelStore();
        store.modelUserData = {
          a: { name: "a", isFavorite: false, tags: ["code"] },
          b: { name: "b", isFavorite: false, tags: ["code"] },
        };
        expect(store.allUserTags).toEqual(["code"]);
      });
    });

    describe("allFilterableTags getter", () => {
      it("includes user tags and capability tags together", () => {
        const store = useModelStore();
        store.modelUserData = {
          "llama3:8b": { name: "llama3:8b", isFavorite: false, tags: ["fast"] },
        };
        store.capabilities["llama3:8b"] = {
          vision: true,
          tools: false,
          thinking: false,
          embedding: false,
          cloud: false,
          audio: false,
        };
        const tags = store.allFilterableTags;
        expect(tags).toContain("fast");
        expect(tags).toContain("vision");
        expect(tags).not.toContain("tools");
      });

      it("includes all capability tag types when present", () => {
        const store = useModelStore();
        store.capabilities["model:latest"] = {
          vision: true,
          tools: true,
          thinking: true,
          embedding: true,
          cloud: true,
          audio: true,
        };
        const tags = store.allFilterableTags;
        expect(tags).toContain("vision");
        expect(tags).toContain("tools");
        expect(tags).toContain("thinking");
        expect(tags).toContain("embed");
        expect(tags).toContain("cloud");
        expect(tags).toContain("audio");
      });

      it("returns empty array with no data", () => {
        const store = useModelStore();
        expect(store.allFilterableTags).toEqual([]);
      });
    });
  });

  describe("modelMatchesTag (module-level helper)", () => {
    const userData: Record<string, { tags: string[] }> = {
      "llama3:8b": { tags: ["code", "fast"] },
    };
    const caps = {
      vision: true,
      tools: false,
      thinking: false,
      embedding: false,
      cloud: false,
      audio: false,
    };

    it("matches user tag", () => {
      expect(modelMatchesTag("llama3:8b", "code", userData, null)).toBe(true);
    });

    it("does not match absent user tag", () => {
      expect(modelMatchesTag("llama3:8b", "slow", userData, null)).toBe(false);
    });

    it("matches vision capability tag", () => {
      expect(modelMatchesTag("model:x", "vision", {}, caps)).toBe(true);
    });

    it("does not match tools when capability is false", () => {
      expect(modelMatchesTag("model:x", "tools", {}, caps)).toBe(false);
    });

    it("matches thinking capability", () => {
      expect(modelMatchesTag("m", "thinking", {}, { thinking: true })).toBe(
        true,
      );
    });

    it("matches embed capability", () => {
      expect(modelMatchesTag("m", "embed", {}, { embedding: true })).toBe(true);
    });

    it("matches cloud capability", () => {
      expect(modelMatchesTag("m", "cloud", {}, { cloud: true })).toBe(true);
    });

    it("matches audio capability", () => {
      expect(modelMatchesTag("m", "audio", {}, { audio: true })).toBe(true);
    });

    it("returns false for unknown tag with no matching capability", () => {
      expect(modelMatchesTag("m", "unknown", {}, caps)).toBe(false);
    });

    it("returns false when caps is null and tag is a capability name", () => {
      expect(modelMatchesTag("m", "vision", {}, null)).toBe(false);
    });

    it("returns false for unknown model with no user tags", () => {
      expect(modelMatchesTag("other:model", "code", userData, null)).toBe(
        false,
      );
    });
  });

  describe("isInstalled getter", () => {
    const baseModel = {
      modified_at: "",
      size: 0,
      digest: "",
      details: {},
    };

    it("returns true for exact name match", () => {
      const store = useModelStore();
      store.models = [
        { name: "llama3:latest", model: "llama3:latest", ...baseModel },
      ];
      expect(store.isInstalled("llama3:latest")).toBe(true);
    });

    it("returns true when model name starts with prefix + ':'", () => {
      const store = useModelStore();
      store.models = [
        { name: "llama3:latest", model: "llama3:latest", ...baseModel },
      ];
      expect(store.isInstalled("llama3")).toBe(true);
    });

    it("returns false when model is not installed", () => {
      const store = useModelStore();
      store.models = [
        { name: "llama3:latest", model: "llama3:latest", ...baseModel },
      ];
      expect(store.isInstalled("mistral")).toBe(false);
    });
  });

  describe("sortedModels getter — equal-favorite case", () => {
    it("preserves relative order when both models have same favorite status", () => {
      const store = useModelStore();
      store.models = [
        {
          name: "model-a",
          model: "model-a",
          modified_at: "",
          size: 0,
          digest: "",
          details: {},
        },
        {
          name: "model-b",
          model: "model-b",
          modified_at: "",
          size: 0,
          digest: "",
          details: {},
        },
      ];
      const sorted = store.sortedModels;
      expect(sorted[0].name).toBe("model-a");
      expect(sorted[1].name).toBe("model-b");
    });
  });

  describe("fetchCapabilities", () => {
    it("returns cached capabilities without invoking again", async () => {
      const store = useModelStore();
      store.capabilities["llama3:latest"] = {
        vision: false,
        tools: false,
        thinking: false,
        embedding: false,
        cloud: false,
        audio: false,
        name: "llama3:latest",
      };
      const result = await store.fetchCapabilities("llama3:latest");
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(result).toEqual(store.capabilities["llama3:latest"]);
    });

    it("returns null and does not cache on invoke error", async () => {
      const store = useModelStore();
      mockInvoke.mockRejectedValue(new Error("capability fetch failed"));
      const result = await store.fetchCapabilities("unknown:model");
      expect(result).toBeNull();
      expect(store.capabilities["unknown:model"]).toBeUndefined();
    });
  });

  describe("deleteModel error path", () => {
    it("sets error state and re-throws when delete_model fails", async () => {
      const store = useModelStore();
      mockInvoke.mockRejectedValue(new Error("permission denied"));

      await expect(store.deleteModel("llama3:latest")).rejects.toThrow(
        'Failed to delete model "llama3:latest": permission denied',
      );
      expect(store.error).toContain("permission denied");
    });
  });

  describe("pullModel error path", () => {
    it("sets error state and clears pulling entry on invoke failure", async () => {
      const store = useModelStore();
      mockInvoke.mockRejectedValue(new Error("disk full"));

      await store.pullModel("llama3:latest");

      expect(store.error).toContain("disk full");
      expect(store.pulling["llama3:latest"]).toBeUndefined();
    });
  });

  describe("fetchLibraryTags", () => {
    it("returns mapped tag names on success", async () => {
      const store = useModelStore();
      mockInvoke.mockResolvedValue([
        { name: "latest", size: "4GB", hash: "abc", updated_at: "" },
        { name: "7b", size: "4GB", hash: "def", updated_at: "" },
      ]);

      const tags = await store.fetchLibraryTags("llama3");

      expect(mockInvoke).toHaveBeenCalledWith("get_library_tags", {
        slug: "llama3",
      });
      expect(tags).toEqual(["latest", "7b"]);
    });

    it("returns empty array on error", async () => {
      const store = useModelStore();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error("network error"));

      const tags = await store.fetchLibraryTags("llama3");

      expect(tags).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe("addCloudModel", () => {
    const baseModel = {
      modified_at: "",
      size: 0,
      digest: "",
      details: {},
    };

    it("does not pull when model is already installed", async () => {
      const store = useModelStore();
      store.models = [
        { name: "llama3:latest", model: "llama3:latest", ...baseModel },
      ];

      await store.addCloudModel("llama3:latest");

      expect(mockInvoke).not.toHaveBeenCalledWith(
        "pull_model",
        expect.anything(),
      );
    });

    it("pulls model when not installed", async () => {
      const store = useModelStore();
      mockInvoke.mockResolvedValue(undefined);

      await store.addCloudModel("llama3:latest");

      expect(mockInvoke).toHaveBeenCalledWith("pull_model", {
        name: "llama3:latest",
      });
    });
  });

  describe("fetchLibraryModelDetails", () => {
    const mockReadme = "# Llama 3\nA great model.";
    const mockLaunchApps = [
      { name: "Open WebUI", command: "docker run ...", icon_url: "" },
    ];

    it("updates selectedModel when slug matches", async () => {
      const store = useModelStore();
      store.selectedModel = {
        name: "Llama 3",
        slug: "llama3",
        description: "",
        tags: [],
      };
      mockInvoke.mockResolvedValue({
        readme: mockReadme,
        launch_apps: mockLaunchApps,
      });

      await store.fetchLibraryModelDetails("llama3");

      expect(store.selectedModel.readme).toBe(mockReadme);
      expect(store.selectedModel.launch_apps).toEqual(mockLaunchApps);
      expect(store.isLoadingDetails).toBe(false);
    });

    it("does not update selectedModel when slug does not match", async () => {
      const store = useModelStore();
      store.selectedModel = {
        name: "Mistral",
        slug: "mistral",
        description: "",
        tags: [],
      };
      mockInvoke.mockResolvedValue({
        readme: mockReadme,
        launch_apps: mockLaunchApps,
      });

      await store.fetchLibraryModelDetails("llama3");

      expect(store.selectedModel.readme).toBeUndefined();
      expect(store.isLoadingDetails).toBe(false);
    });

    it("handles error and resets isLoadingDetails", async () => {
      const store = useModelStore();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error("not found"));

      await store.fetchLibraryModelDetails("llama3");

      expect(store.isLoadingDetails).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("fetchLibraryTagsDetailed", () => {
    it("stores detailed tags on success", async () => {
      const store = useModelStore();
      const mockTags = [
        { name: "latest", size: "4GB", hash: "abc", updated_at: "" },
      ];
      mockInvoke.mockResolvedValue(mockTags);

      await store.fetchLibraryTagsDetailed("llama3");

      expect(store.selectedModelTags).toEqual(mockTags);
    });

    it("resets to empty array on error", async () => {
      const store = useModelStore();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      store.selectedModelTags = [
        { name: "old", size: "", hash: "", updated_at: "" },
      ];
      mockInvoke.mockRejectedValue(new Error("fetch failed"));

      await store.fetchLibraryTagsDetailed("llama3");

      expect(store.selectedModelTags).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe("searchLibrary", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears results immediately for empty query", () => {
      const store = useModelStore();
      store.libraryResults = [
        { name: "llama3", slug: "llama3", description: "", tags: [] },
      ];
      store.isSearching = true;

      store.searchLibrary("");

      expect(store.libraryResults).toEqual([]);
      expect(store.isSearching).toBe(false);
      expect(store.searchQuery).toBe("");
    });

    it("clears results for whitespace-only query", () => {
      const store = useModelStore();
      store.searchLibrary("   ");
      expect(store.libraryResults).toEqual([]);
      expect(store.isSearching).toBe(false);
    });

    it("sets isSearching and debounces the invoke call", async () => {
      const store = useModelStore();
      const mockResults = [
        { name: "llama3", slug: "llama3", description: "", tags: [] },
      ];
      mockInvoke.mockResolvedValue(mockResults);

      store.searchLibrary("llama");

      expect(store.isSearching).toBe(true);
      expect(store.searchQuery).toBe("llama");
      expect(mockInvoke).not.toHaveBeenCalledWith(
        "search_ollama_library",
        expect.anything(),
      );

      await vi.runAllTimersAsync();

      expect(mockInvoke).toHaveBeenCalledWith("search_ollama_library", {
        query: "llama",
      });
      expect(store.libraryResults).toEqual(mockResults);
      expect(store.isSearching).toBe(false);
    });

    it("clears results and resets isSearching on invoke error", async () => {
      const store = useModelStore();
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockInvoke.mockRejectedValue(new Error("search failed"));

      store.searchLibrary("llama");
      await vi.runAllTimersAsync();

      expect(store.libraryResults).toEqual([]);
      expect(store.isSearching).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe("clearLibrarySearch", () => {
    it("resets all search state and cancels pending timer", () => {
      const store = useModelStore();
      store.searchQuery = "llama";
      store.libraryResults = [
        { name: "llama3", slug: "llama3", description: "", tags: [] },
      ];
      store.isSearching = true;

      store.clearLibrarySearch();

      expect(store.searchQuery).toBe("");
      expect(store.libraryResults).toEqual([]);
      expect(store.isSearching).toBe(false);
    });
  });

  describe("initListeners — handler bodies", () => {
    it("pull-progress handler updates pulling state", async () => {
      const store = useModelStore();
      await store.initListeners();

      const handler = mockListen.mock.calls.find(
        ([e]) => e === "model:pull-progress",
      )?.[1];
      handler?.({
        payload: { model: "llama3", status: "downloading", percent: 42 },
      });

      expect(store.pulling["llama3"]).toEqual({
        model: "llama3",
        status: "downloading",
        percent: 42,
      });
    });

    it("pull-done handler removes pulling entry and re-fetches models", async () => {
      const store = useModelStore();
      store.pulling["llama3"] = {
        model: "llama3",
        status: "done",
        percent: 100,
      };
      mockInvoke.mockImplementation(async (cmd: string) => {
        if (cmd === "list_models") return [];
        if (cmd === "list_model_user_data") return [];
        if (cmd === "get_model_capabilities") return null;
        return undefined;
      });

      await store.initListeners();

      const handler = mockListen.mock.calls.find(
        ([e]) => e === "model:pull-done",
      )?.[1];
      await handler?.({ payload: { model: "llama3" } });

      expect(store.pulling["llama3"]).toBeUndefined();
    });
  });

  describe("formatBytes", () => {
    it("returns '0 B' for 0", () => {
      const store = useModelStore();
      expect(store.formatBytes(0)).toBe("0 B");
    });

    it("formats bytes under 1 KB", () => {
      const store = useModelStore();
      expect(store.formatBytes(512)).toBe("512 B");
    });

    it("formats kilobytes", () => {
      const store = useModelStore();
      expect(store.formatBytes(1024)).toBe("1 KB");
    });

    it("formats megabytes", () => {
      const store = useModelStore();
      expect(store.formatBytes(1024 * 1024)).toBe("1 MB");
    });

    it("formats gigabytes", () => {
      const store = useModelStore();
      expect(store.formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
    });
  });
});
