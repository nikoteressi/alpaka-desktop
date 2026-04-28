import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useModelStore } from "./models";

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
    mockInvoke.mockResolvedValue(MOCK_MODELS);

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

    expect(mockListen).toHaveBeenCalledTimes(2); // once for each event, not 4
  });
});
