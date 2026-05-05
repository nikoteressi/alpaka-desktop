import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

import { useModelStore } from "../../stores/models";
import LocalModelsTab from "./LocalModelsTab.vue";
import type { Model } from "../../types/models";
import type { ModelName } from "../../types/models";

function makeModel(name: string, overrides: Partial<Model> = {}): Model {
  return {
    name: name as ModelName,
    model: name,
    modified_at: "2024-01-01T00:00:00Z",
    size: 4_700_000_000,
    digest: "abc123",
    details: {
      parent_model: "",
      format: "gguf",
      family: "llama",
      families: null,
      parameter_size: "8B",
      quantization_level: "Q4_K_M",
    },
    ...overrides,
  };
}

const globalStubs = {
  stubs: {
    ModelCard: {
      name: "ModelCard",
      template: '<div data-testid="model-card">{{ name }}</div>',
      props: ["name", "tags", "fileSize", "date", "quant", "isInstalled",
              "isFavorite", "onFavorite", "userTags", "onClick", "onDelete",
              "onEditTags", "actionLabel"],
    },
    CustomTooltip: { template: "<div><slot /></div>" },
  },
};

async function mountTab(
  storeSetup: (store: ReturnType<typeof useModelStore>) => void = () => {},
) {
  const store = useModelStore();
  storeSetup(store);
  const wrapper = mount(LocalModelsTab, { global: globalStubs });
  await flushPromises();
  return { wrapper, store };
}

describe("LocalModelsTab", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("renders a loading spinner when isLoading is true", async () => {
    const { wrapper } = await mountTab((s) => { s.isLoading = true; });
    expect(wrapper.text()).toContain("Loading installed models");
  });

  it("renders error state when store has an error", async () => {
    const { wrapper } = await mountTab((s) => {
      s.isLoading = false;
      s.error = "Connection refused";
    });
    expect(wrapper.text()).toContain("Failed to load models");
    expect(wrapper.text()).toContain("Connection refused");
  });

  it("renders empty state when no models installed", async () => {
    const { wrapper } = await mountTab((s) => {
      s.isLoading = false;
      s.error = null;
      s.models = [];
    });
    expect(wrapper.text()).toContain("No models installed locally");
  });

  it("renders model cards when models exist", async () => {
    const { wrapper } = await mountTab((s) => {
      s.isLoading = false;
      s.error = null;
      s.models = [makeModel("llama3:8b"), makeModel("mistral:7b")];
    });
    const cards = wrapper.findAll('[data-testid="model-card"]');
    expect(cards.length).toBe(2);
  });

  it("renders the installed model count", async () => {
    const { wrapper } = await mountTab((s) => {
      s.isLoading = false;
      s.models = [makeModel("llama3:8b"), makeModel("mistral:7b")];
    });
    expect(wrapper.text()).toContain("2 Installed Models");
  });

  it("shows All tag filter button", async () => {
    const { wrapper } = await mountTab((s) => {
      s.isLoading = false;
      s.models = [makeModel("llama3:8b")];
    });
    expect(wrapper.text()).toContain("All");
  });

  it("emits open-model when a model card's onClick fires", async () => {
    const { wrapper } = await mountTab((s) => {
      s.isLoading = false;
      s.models = [makeModel("llama3:8b")];
    });
    // Get the onClick prop from the first model card stub and call it
    const card = wrapper.findComponent({ name: "ModelCard" });
    const onClick = card.props("onClick") as () => void;
    onClick();
    await flushPromises();
    expect(wrapper.emitted("open-model")).toBeTruthy();
    expect(wrapper.emitted("open-model")![0][0]).toBe("llama3:8b");
  });

  it("emits delete-model when a model card's onDelete fires", async () => {
    const { wrapper } = await mountTab((s) => {
      s.isLoading = false;
      s.models = [makeModel("llama3:8b")];
    });
    const card = wrapper.findComponent({ name: "ModelCard" });
    const onDelete = card.props("onDelete") as () => void;
    onDelete();
    await flushPromises();
    expect(wrapper.emitted("delete-model")).toBeTruthy();
    expect(wrapper.emitted("delete-model")![0][0]).toBe("llama3:8b");
  });

  it("shows inline tag editor when a model card's onEditTags fires", async () => {
    const { wrapper } = await mountTab((s) => {
      s.isLoading = false;
      s.models = [makeModel("llama3:8b")];
    });
    const card = wrapper.findComponent({ name: "ModelCard" });
    const onEditTags = card.props("onEditTags") as () => void;
    onEditTags();
    await flushPromises();
    expect(wrapper.find("input[placeholder*='Add tags']").exists()).toBe(true);
  });
});
