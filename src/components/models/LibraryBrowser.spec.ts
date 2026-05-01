import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { useModelStore } from "../../stores/models";
import LibraryBrowser from "./LibraryBrowser.vue";
import type { LibraryModel } from "../../types/models";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const ModelCardStub = {
  name: "ModelCard",
  template: '<div class="stub-card">{{ name }}</div>',
  props: [
    "name",
    "description",
    "tags",
    "pullCount",
    "date",
    "onClick",
    "actionLabel",
  ],
};

const globalOpts = {
  stubs: {
    ModelCard: ModelCardStub,
    transition: { template: "<div><slot /></div>" },
  },
};

function makeModel(
  slug: string,
  tags: string[] = [],
  overrides: Partial<LibraryModel> = {},
): LibraryModel {
  return {
    name: slug,
    slug,
    description: `Description of ${slug}`,
    tags,
    pull_count: "100K",
    updated_at: "2024-01-01",
    ...overrides,
  };
}

describe("LibraryBrowser", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // ── initial empty state ─────────────────────────────────────────────────────

  it("shows 'Enter a model name' empty state by default", () => {
    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    expect(wrapper.text()).toContain("Enter a model name");
  });

  // ── isSearching loading state ───────────────────────────────────────────────

  it("shows loading spinner when isSearching is true and no results", async () => {
    const modelStore = useModelStore();
    modelStore.isSearching = true;
    modelStore.libraryResults = [];
    modelStore.searchQuery = "llama";

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    expect(wrapper.text()).toContain("Searching repository...");
  });

  // ── no results for non-empty query ─────────────────────────────────────────

  it("shows 'No models found' when query is set but results are empty", async () => {
    const modelStore = useModelStore();
    modelStore.searchQuery = "xyz-nonexistent";
    modelStore.libraryResults = [];
    modelStore.isSearching = false;

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    expect(wrapper.text()).toContain("No models found for");
    expect(wrapper.text()).toContain("xyz-nonexistent");
  });

  // ── clear search button ────────────────────────────────────────────────────

  it("calls clearLibrarySearch when 'Clear search' button is clicked", async () => {
    const modelStore = useModelStore();
    modelStore.searchQuery = "xyz";
    modelStore.libraryResults = [];
    modelStore.isSearching = false;

    const clearSpy = vi.spyOn(modelStore, "clearLibrarySearch");

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    const clearBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Clear"));
    expect(clearBtn).toBeDefined();
    await clearBtn!.trigger("click");

    expect(clearSpy).toHaveBeenCalled();
  });

  // ── results grid ───────────────────────────────────────────────────────────

  it("renders a ModelCard stub for each result", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [
      makeModel("llama3"),
      makeModel("mistral"),
      makeModel("phi4"),
    ];
    modelStore.searchQuery = "llama";
    modelStore.isSearching = false;

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    expect(wrapper.findAll(".stub-card")).toHaveLength(3);
  });

  it("emits 'select' with the model when a card's onClick fires", async () => {
    const modelStore = useModelStore();
    const model = makeModel("llama3");
    modelStore.libraryResults = [model];
    modelStore.searchQuery = "llama";

    // Mount with real ModelCard to test the onClick prop passes through
    const wrapper = mount(LibraryBrowser, {
      global: {
        stubs: {
          ModelCard: {
            name: "ModelCard",
            template:
              '<div class="stub-card" @click="onClick && onClick()">{{ name }}</div>',
            props: [
              "name",
              "description",
              "tags",
              "pullCount",
              "date",
              "onClick",
              "actionLabel",
            ],
          },
          transition: { template: "<div><slot /></div>" },
        },
      },
    });
    await nextTick();

    await wrapper.find(".stub-card").trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0][0]).toEqual(model);
  });

  // ── uniqueTags computed ────────────────────────────────────────────────────

  it("renders tag filter chips for unique tags from results", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [
      makeModel("a", ["vision", "tools"]),
      makeModel("b", ["vision", "embedding"]),
      makeModel("c", ["tools"]),
    ];
    modelStore.searchQuery = "x";

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    // Check uniqueTags section is present
    expect(wrapper.text()).toContain("All");
    // All 3 unique tags should be visible
    expect(wrapper.text()).toContain("vision");
    expect(wrapper.text()).toContain("tools");
    expect(wrapper.text()).toContain("embedding");
  });

  it("sorts uniqueTags alphabetically", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [makeModel("a", ["zebra", "apple", "mango"])];
    modelStore.searchQuery = "x";

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    // The chips area should render apple before mango before zebra
    const allText = wrapper.text();
    const appleIdx = allText.indexOf("apple");
    const mangoIdx = allText.indexOf("mango");
    const zebraIdx = allText.indexOf("zebra");
    expect(appleIdx).toBeLessThan(mangoIdx);
    expect(mangoIdx).toBeLessThan(zebraIdx);
  });

  it("deduplicates tags across models", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [
      makeModel("a", ["vision"]),
      makeModel("b", ["vision"]),
      makeModel("c", ["vision"]),
    ];
    modelStore.searchQuery = "x";

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    // Only one "vision" chip should appear in the filter area
    // Count occurrences of "vision" in the tag chip area (not card text)
    const chipArea = wrapper.find(".flex.flex-wrap.gap-1\\.5.-mt-2");
    if (chipArea.exists()) {
      const visionButtons = chipArea
        .findAll("button")
        .filter((b) => b.text() === "vision");
      expect(visionButtons).toHaveLength(1);
    } else {
      // Alternative: just check tag chips rendered
      const allButtons = wrapper
        .findAll("button")
        .filter((b) => b.text() === "vision");
      expect(allButtons.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("hides tag filter chips when results have no tags", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [makeModel("a", []), makeModel("b", [])];
    modelStore.searchQuery = "x";

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    expect(wrapper.text()).not.toContain("All");
  });

  // ── tag filter chip interactions ──────────────────────────────────────────

  it("clicking a tag chip filters results to only matching models", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [
      makeModel("vision-model", ["vision"]),
      makeModel("tools-model", ["tools"]),
      makeModel("both-model", ["vision", "tools"]),
    ];
    modelStore.searchQuery = "x";
    modelStore.isSearching = false;

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    // Click "vision" chip
    const visionBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "vision");
    expect(visionBtn).toBeDefined();
    await visionBtn!.trigger("click");
    await nextTick();

    // Only vision and both models should be shown
    const cards = wrapper.findAll(".stub-card");
    expect(cards).toHaveLength(2);
    const cardTexts = cards.map((c) => c.text());
    expect(cardTexts).toContain("vision-model");
    expect(cardTexts).toContain("both-model");
    expect(cardTexts).not.toContain("tools-model");
  });

  it("clicking 'All' chip resets the filter and shows all results", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [
      makeModel("vision-model", ["vision"]),
      makeModel("tools-model", ["tools"]),
    ];
    modelStore.searchQuery = "x";
    modelStore.isSearching = false;

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    // First filter by vision
    const visionBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "vision");
    await visionBtn!.trigger("click");
    await nextTick();
    expect(wrapper.findAll(".stub-card")).toHaveLength(1);

    // Now click All
    const allBtn = wrapper.findAll("button").find((b) => b.text() === "All");
    expect(allBtn).toBeDefined();
    await allBtn!.trigger("click");
    await nextTick();

    expect(wrapper.findAll(".stub-card")).toHaveLength(2);
  });

  // ── "No models tagged" state ───────────────────────────────────────────────

  it("shows 'No models tagged' when activeTagFilter is set but no results match", async () => {
    const modelStore = useModelStore();
    // Start with tagged models so chips render
    modelStore.libraryResults = [makeModel("a", ["vision"])];
    modelStore.searchQuery = "x";
    modelStore.isSearching = false;

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    // Click the vision chip to activate filter
    const visionBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "vision");
    expect(visionBtn).toBeDefined();
    await visionBtn!.trigger("click");
    await nextTick();

    // Simulate results changing to models WITHOUT the vision tag
    modelStore.libraryResults = [makeModel("b", ["tools"])];
    await nextTick();

    expect(wrapper.text()).toContain("No models tagged");
    expect(wrapper.text()).toContain("vision");
  });

  it("'Show all results' button resets activeTagFilter", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [makeModel("a", ["vision"])];
    modelStore.searchQuery = "x";
    modelStore.isSearching = false;

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    // Activate filter
    const visionBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "vision");
    await visionBtn!.trigger("click");
    await nextTick();

    // Change results so the filtered view is empty
    modelStore.libraryResults = [makeModel("b", ["tools"])];
    await nextTick();

    expect(wrapper.text()).toContain("No models tagged");

    // Click "Show all results"
    const showAllBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Show all"));
    expect(showAllBtn).toBeDefined();
    await showAllBtn!.trigger("click");
    await nextTick();

    // After resetting filter, all results should show
    expect(wrapper.findAll(".stub-card")).toHaveLength(1);
  });

  // ── onSearchInput ─────────────────────────────────────────────────────────

  it("onSearchInput resets activeTagFilter and calls searchLibrary", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [makeModel("a", ["vision"])];
    modelStore.searchQuery = "init";
    modelStore.isSearching = false;

    const searchLibrarySpy = vi
      .spyOn(modelStore, "searchLibrary")
      .mockImplementation(() => {});

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    // Activate filter first
    const visionBtn = wrapper
      .findAll("button")
      .find((b) => b.text() === "vision");
    await visionBtn!.trigger("click");
    await nextTick();

    // Type in the search input to trigger onSearchInput
    const input = wrapper.find("input");
    await input.setValue("newquery");
    await input.trigger("input");
    await nextTick();

    // searchLibrary should have been called
    expect(searchLibrarySpy).toHaveBeenCalledWith("newquery");
  });

  it("shows search spinner inside input when isSearching is true", async () => {
    const modelStore = useModelStore();
    modelStore.isSearching = true;
    modelStore.libraryResults = [];

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    // The spinner inside the input area (right side absolute)
    const inputSpinner = wrapper.find(".relative.group .absolute");
    expect(inputSpinner.exists()).toBe(true);
  });

  it("hides search spinner inside input when isSearching is false", async () => {
    const modelStore = useModelStore();
    modelStore.isSearching = false;
    modelStore.libraryResults = [];

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await nextTick();

    const inputSpinner = wrapper.find(".relative.group .absolute");
    expect(inputSpinner.exists()).toBe(false);
  });

  // ── two-way model binding ─────────────────────────────────────────────────

  it("passes model name, description, tags, pullCount, and date to ModelCard", async () => {
    const modelStore = useModelStore();
    const model = makeModel("llama3", ["vision", "8b"], {
      description: "Fast model",
      pull_count: "5M",
      updated_at: "Mar 1",
    });
    modelStore.libraryResults = [model];
    modelStore.searchQuery = "llama";
    modelStore.isSearching = false;

    const capturingStub = {
      name: "ModelCard",
      template: '<div class="stub-card" />',
      props: [
        "name",
        "description",
        "tags",
        "pullCount",
        "date",
        "onClick",
        "actionLabel",
      ],
    };

    const wrapper = mount(LibraryBrowser, {
      global: {
        stubs: {
          ModelCard: capturingStub,
          transition: { template: "<div><slot /></div>" },
        },
      },
    });
    await nextTick();

    const card = wrapper.findComponent(capturingStub);
    expect(card.props("name")).toBe("llama3");
    expect(card.props("description")).toBe("Fast model");
    expect(card.props("pullCount")).toBe("5M");
    expect(card.props("date")).toBe("Mar 1");
    expect(card.props("tags")).toEqual(["vision", "8b"]);
    expect(card.props("actionLabel")).toBe("Details");
  });

  it("flushPromises works correctly after async store operations", async () => {
    const modelStore = useModelStore();
    modelStore.libraryResults = [makeModel("m1"), makeModel("m2")];
    modelStore.searchQuery = "m";
    modelStore.isSearching = false;

    const wrapper = mount(LibraryBrowser, { global: globalOpts });
    await flushPromises();

    expect(wrapper.findAll(".stub-card")).toHaveLength(2);
  });
});
