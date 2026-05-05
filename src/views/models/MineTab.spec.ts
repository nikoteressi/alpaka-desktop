import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import MineTab from "./MineTab.vue";
import { useModelStore } from "../../stores/models";
import { useAuthStore } from "../../stores/auth";
import type { ModelName } from "../../types/models";

// --- Module-level mocks ---

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

// Stub child components
const ModelCardStub = {
  name: "ModelCard",
  template: "<div data-testid='model-card'>{{ name }}</div>",
  props: [
    "name",
    "tags",
    "fileSize",
    "date",
    "quant",
    "isInstalled",
    "isFavorite",
    "onFavorite",
    "userTags",
    "onClick",
    "onDelete",
    "onEditTags",
    "actionLabel",
  ],
};
const CustomTooltipStub = {
  name: "CustomTooltip",
  template: "<slot />",
  props: ["text", "wrapperClass"],
};

const GLOBAL_STUBS = {
  ModelCard: ModelCardStub,
  CustomTooltip: CustomTooltipStub,
};

function mountMineTab() {
  return mount(MineTab, { global: { stubs: GLOBAL_STUBS } });
}

// Helper: a minimal model with a namespaced name (user/model format)
function makeNamespacedModel(name: string) {
  return {
    name: name as ModelName,
    size: 4_000_000_000,
    digest: "abc123",
    details: {
      parameter_size: "7B",
      quantization_level: "Q4_K_M",
      format: "gguf",
      family: "llama",
      families: ["llama"],
    },
    modified_at: "2026-01-15T12:00:00Z",
  };
}

// --- Tests ---

describe("MineTab — rendering", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("renders without crashing", () => {
    const wrapper = mountMineTab();
    expect(wrapper.exists()).toBe(true);
  });

  it("shows empty state when no namespaced models are present", () => {
    const wrapper = mountMineTab();
    expect(wrapper.text()).toContain("No private models yet");
  });

  it("renders model cards for namespaced models (name contains /)", () => {
    const modelStore = useModelStore();
    modelStore.models.push(makeNamespacedModel("alice/llama3:8b") as any);

    const wrapper = mountMineTab();
    expect(wrapper.findAll('[data-testid="model-card"]')).toHaveLength(1);
  });

  it("does NOT show non-namespaced models", () => {
    const modelStore = useModelStore();
    modelStore.models.push({
      name: "llama3:8b" as ModelName,
      size: 4_000_000_000,
      digest: "abc123",
      details: {
        parameter_size: "7B",
        quantization_level: "Q4_K_M",
        format: "gguf",
        family: "llama",
        families: ["llama"],
      },
      modified_at: "2026-01-15T12:00:00Z",
    } as any);

    const wrapper = mountMineTab();
    expect(wrapper.find('[data-testid="model-card"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("No private models yet");
  });

  it("shows active push progress when pushing is non-empty", () => {
    const modelStore = useModelStore();
    modelStore.pushing = {
      "alice/llama3:8b": { model: "alice/llama3:8b", status: "Uploading...", percent: 45 },
    };

    const wrapper = mountMineTab();
    expect(wrapper.text()).toContain("Active Uploads");
    expect(wrapper.text()).toContain("alice/llama3:8b");
    expect(wrapper.text()).toContain("Uploading...");
  });

  it("pull button is disabled when user is not authenticated", () => {
    const wrapper = mountMineTab();
    const pullBtn = wrapper.find('button[disabled]');
    expect(pullBtn.exists()).toBe(true);
  });

  it("pull button is enabled when user is authenticated and name is filled", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u1", username: "alice" };

    const wrapper = mountMineTab();
    const input = wrapper.find('input[placeholder="username/modelname:tag"]');
    await input.setValue("alice/mymodel:latest");

    const pullBtn = wrapper.find('button.bg-\\[var\\(--accent\\)\\]');
    expect(pullBtn.attributes("disabled")).toBeUndefined();
  });
});

describe("MineTab — doPullPrivateModel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("happy path: calls modelStore.pullModel with the entered name", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u1", username: "alice" };

    const modelStore = useModelStore();
    const pullSpy = vi.spyOn(modelStore, "pullModel").mockResolvedValue();

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      privateModelName: string;
      doPullPrivateModel: () => Promise<void>;
    };

    vm.privateModelName = "alice/mymodel:latest";
    await vm.doPullPrivateModel();

    expect(pullSpy).toHaveBeenCalledWith("alice/mymodel:latest");
  });

  it("clears privateModelName after starting pull", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u1", username: "alice" };

    const modelStore = useModelStore();
    vi.spyOn(modelStore, "pullModel").mockResolvedValue();

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      privateModelName: string;
      doPullPrivateModel: () => Promise<void>;
    };

    vm.privateModelName = "alice/mymodel:latest";
    await vm.doPullPrivateModel();

    expect(vm.privateModelName).toBe("");
  });

  it("does nothing when name is empty", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u1", username: "alice" };

    const modelStore = useModelStore();
    const pullSpy = vi.spyOn(modelStore, "pullModel").mockResolvedValue();

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      privateModelName: string;
      doPullPrivateModel: () => Promise<void>;
    };

    vm.privateModelName = "   ";
    await vm.doPullPrivateModel();

    expect(pullSpy).not.toHaveBeenCalled();
  });

  it("does nothing when user is not authenticated", async () => {
    const modelStore = useModelStore();
    const pullSpy = vi.spyOn(modelStore, "pullModel").mockResolvedValue();

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      privateModelName: string;
      doPullPrivateModel: () => Promise<void>;
    };

    vm.privateModelName = "alice/mymodel:latest";
    await vm.doPullPrivateModel();

    expect(pullSpy).not.toHaveBeenCalled();
  });

  it("does nothing when already pulling the same model", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u1", username: "alice" };

    const modelStore = useModelStore();
    // Simulate already pulling
    modelStore.pulling["alice/mymodel:latest"] = {
      model: "alice/mymodel:latest",
      status: "pulling...",
      percent: 50,
    };
    const pullSpy = vi.spyOn(modelStore, "pullModel").mockResolvedValue();

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      privateModelName: string;
      pullingPrivateName: string;
      doPullPrivateModel: () => Promise<void>;
    };

    // Set pullingPrivateName to simulate ongoing pull
    vm.pullingPrivateName = "alice/mymodel:latest";
    vm.privateModelName = "alice/mymodel:latest";
    await vm.doPullPrivateModel();

    expect(pullSpy).not.toHaveBeenCalled();
  });

  it("clears pullingPrivateName even when pullModel throws", async () => {
    const authStore = useAuthStore();
    authStore.user = { id: "u1", username: "alice" };

    const modelStore = useModelStore();
    vi.spyOn(modelStore, "pullModel").mockRejectedValue(new Error("Network error"));

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      privateModelName: string;
      pullingPrivateName: string;
      doPullPrivateModel: () => Promise<void>;
    };

    vm.privateModelName = "alice/mymodel:latest";
    // The error propagates but pullingPrivateName is cleaned up in finally
    try {
      await vm.doPullPrivateModel();
    } catch {
      // expected
    }
    expect(vm.pullingPrivateName).toBe("");
  });
});

describe("MineTab — tag editor", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("openTagEditor sets editingTagsFor and populates tagInputValue from store", async () => {
    const modelStore = useModelStore();
    modelStore.modelUserData["alice/llama3:8b"] = {
      name: "alice/llama3:8b",
      isFavorite: false,
      tags: ["fast", "small"],
    };

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      openTagEditor: (name: string) => void;
      editingTagsFor: string | null;
      tagInputValue: string;
    };

    vm.openTagEditor("alice/llama3:8b");
    await wrapper.vm.$nextTick();

    expect(vm.editingTagsFor).toBe("alice/llama3:8b");
    expect(vm.tagInputValue).toBe("fast, small");
  });

  it("openTagEditor shows empty tagInputValue when model has no tags", async () => {
    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      openTagEditor: (name: string) => void;
      tagInputValue: string;
    };

    vm.openTagEditor("alice/no-tags:latest");
    expect(vm.tagInputValue).toBe("");
  });

  it("saveTagsFor parses comma-separated tags and calls modelStore.setModelTags", async () => {
    const modelStore = useModelStore();
    const setTagsSpy = vi.spyOn(modelStore, "setModelTags").mockResolvedValue();

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      tagInputValue: string;
      editingTagsFor: string | null;
      saveTagsFor: (name: string) => Promise<void>;
    };

    vm.tagInputValue = "fast,  small,  ";
    await vm.saveTagsFor("alice/llama3:8b");

    expect(setTagsSpy).toHaveBeenCalledWith("alice/llama3:8b", ["fast", "small"]);
    expect(vm.editingTagsFor).toBeNull();
    expect(vm.tagInputValue).toBe("");
  });

  it("saveTagsFor filters out empty tokens", async () => {
    const modelStore = useModelStore();
    const setTagsSpy = vi.spyOn(modelStore, "setModelTags").mockResolvedValue();

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      tagInputValue: string;
      saveTagsFor: (name: string) => Promise<void>;
    };

    vm.tagInputValue = ",,,";
    await vm.saveTagsFor("alice/llama3:8b");

    expect(setTagsSpy).toHaveBeenCalledWith("alice/llama3:8b", []);
  });
});

describe("MineTab — getActiveCaps", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("returns empty array when capabilities not set for model", () => {
    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      getActiveCaps: (name: string) => string[];
    };
    expect(vm.getActiveCaps("alice/unknown:latest")).toEqual([]);
  });

  it("returns only the enabled capabilities", () => {
    const modelStore = useModelStore();
    modelStore.capabilities["alice/llava:7b"] = {
      vision: true,
      tools: false,
      thinking: true,
      thinking_toggleable: false,
      thinking_levels: [],
      embedding: false,
      audio: false,
      cloud: false,
    };

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      getActiveCaps: (name: string) => string[];
    };

    const caps = vm.getActiveCaps("alice/llava:7b");
    expect(caps).toContain("vision");
    expect(caps).toContain("thinking");
    expect(caps).not.toContain("tools");
  });

  it("returns all three when all caps are enabled", () => {
    const modelStore = useModelStore();
    modelStore.capabilities["alice/full:7b"] = {
      vision: true,
      tools: true,
      thinking: true,
      thinking_toggleable: true,
      thinking_levels: [],
      embedding: false,
      audio: false,
      cloud: false,
    };

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      getActiveCaps: (name: string) => string[];
    };

    expect(vm.getActiveCaps("alice/full:7b")).toEqual(["vision", "tools", "thinking"]);
  });
});

describe("MineTab — formatSize", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("formats bytes >= 1e9 as GB", () => {
    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as { formatSize: (b: number) => string };
    expect(vm.formatSize(4_200_000_000)).toBe("4.2 GB");
  });

  it("formats bytes >= 1e6 as MB", () => {
    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as { formatSize: (b: number) => string };
    expect(vm.formatSize(500_000_000)).toBe("500 MB");
  });

  it("formats small bytes as raw bytes", () => {
    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as { formatSize: (b: number) => string };
    expect(vm.formatSize(1024)).toBe("1024 B");
  });
});

describe("MineTab — formatDateShort", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it('returns "Unknown" for an empty string', () => {
    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      formatDateShort: (s: string) => string;
    };
    expect(vm.formatDateShort("")).toBe("Unknown");
  });

  it("returns a formatted date string for a valid ISO date", () => {
    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      formatDateShort: (s: string) => string;
    };
    const result = vm.formatDateShort("2026-01-15T12:00:00Z");
    expect(result).toBeTruthy();
    expect(result).not.toBe("Unknown");
  });
});

describe("MineTab — myModels computed", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockResolvedValue(undefined);
  });

  it("includes only models whose name contains /", () => {
    const modelStore = useModelStore();
    modelStore.models.push(makeNamespacedModel("alice/llama3:8b") as any);
    modelStore.models.push({
      name: "llama3:8b" as ModelName,
      size: 0,
      digest: "",
      details: { parameter_size: "", quantization_level: "", format: "", family: "", families: [] },
      modified_at: "",
    } as any);

    const wrapper = mountMineTab();
    const vm = wrapper.vm as unknown as {
      myModels: Array<{ name: string }>;
    };

    expect(vm.myModels).toHaveLength(1);
    expect(vm.myModels[0].name).toBe("alice/llama3:8b");
  });
});
