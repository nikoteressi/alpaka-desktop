import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ModelSelector from "./ModelSelector.vue";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const ModelTagBadgeStub = {
  name: "ModelTagBadge",
  template: "<span />",
  props: ["tag"],
};

function makeWrapper(activeModel = "llama3") {
  return mount(ModelSelector, {
    props: { activeModelName: activeModel, isActiveModelPulling: false },
    global: { stubs: { ModelTagBadge: ModelTagBadgeStub } },
  });
}

async function openDropdown(wrapper: ReturnType<typeof makeWrapper>) {
  await wrapper.find("button").trigger("click");
  await wrapper.vm.$nextTick();
}

describe("ModelSelector", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("renders the active model name", () => {
    const wrapper = makeWrapper("qwen2:0.5b");
    expect(wrapper.text()).toContain("qwen2:0.5b");
  });

  it("opens dropdown on button click", async () => {
    const wrapper = makeWrapper();
    await openDropdown(wrapper);
    expect(wrapper.find("input").exists()).toBe(true);
  });

  it("closes dropdown on second button click", async () => {
    const wrapper = makeWrapper();
    await openDropdown(wrapper);
    await wrapper.find("button").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("input").exists()).toBe(false);
  });

  it("shows installed models from store", async () => {
    setActivePinia(createPinia());
    const { useModelStore } = await import("../../../stores/models");
    const store = useModelStore();
    store.models = [
      {
        name: "llama3",
        size: 1000,
        digest: "abc",
        details: { parameter_size: "8B", quantization_level: "Q4" },
        modified_at: "",
      },
    ] as never;

    const wrapper = makeWrapper("llama3");
    await openDropdown(wrapper);
    expect(wrapper.text()).toContain("llama3");
  });
});

describe("ModelSelector — keyboard navigation", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const { useModelStore } = await import("../../../stores/models");
    const store = useModelStore();
    store.models = [
      {
        name: "llama3",
        size: 1000,
        digest: "a",
        details: { parameter_size: "8B", quantization_level: "Q4" },
        modified_at: "",
      },
      {
        name: "mistral",
        size: 2000,
        digest: "b",
        details: { parameter_size: "7B", quantization_level: "Q4" },
        modified_at: "",
      },
    ] as never;
  });

  async function openAndGetInput(wrapper: ReturnType<typeof makeWrapper>) {
    await openDropdown(wrapper);
    return wrapper.find("input");
  }

  it("ArrowDown moves focus to first model", async () => {
    const wrapper = makeWrapper();
    const input = await openAndGetInput(wrapper);
    await input.trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as unknown as { focusedIndex: number };
    expect(vm.focusedIndex).toBe(0);
  });

  it("ArrowDown advances focus through models", async () => {
    const wrapper = makeWrapper();
    const input = await openAndGetInput(wrapper);
    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as unknown as { focusedIndex: number };
    expect(vm.focusedIndex).toBe(1);
  });

  it("ArrowDown does not exceed last model index", async () => {
    const wrapper = makeWrapper();
    const input = await openAndGetInput(wrapper);
    for (let i = 0; i < 5; i++) {
      await input.trigger("keydown", { key: "ArrowDown" });
    }
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as unknown as { focusedIndex: number };
    expect(vm.focusedIndex).toBe(1);
  });

  it("ArrowUp decrements focus", async () => {
    const wrapper = makeWrapper();
    const input = await openAndGetInput(wrapper);
    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "ArrowUp" });
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as unknown as { focusedIndex: number };
    expect(vm.focusedIndex).toBe(0);
  });

  it("ArrowUp does not go below -1", async () => {
    const wrapper = makeWrapper();
    const input = await openAndGetInput(wrapper);
    await input.trigger("keydown", { key: "ArrowUp" });
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as unknown as { focusedIndex: number };
    expect(vm.focusedIndex).toBe(-1);
  });

  it("Enter selects the focused model", async () => {
    const wrapper = makeWrapper();
    const input = await openAndGetInput(wrapper);
    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "Enter" });
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0]).toEqual(["llama3"]);
  });

  it("Enter does nothing when no model is focused", async () => {
    const wrapper = makeWrapper();
    const input = await openAndGetInput(wrapper);
    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("select")).toBeFalsy();
  });

  it("Escape closes the dropdown", async () => {
    const wrapper = makeWrapper();
    const input = await openAndGetInput(wrapper);
    await input.trigger("keydown", { key: "Escape" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find("input").exists()).toBe(false);
  });

  it("typing in search resets focusedIndex to -1", async () => {
    const wrapper = makeWrapper();
    const input = await openAndGetInput(wrapper);
    await input.trigger("keydown", { key: "ArrowDown" });
    await input.setValue("ll");
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as unknown as { focusedIndex: number };
    expect(vm.focusedIndex).toBe(-1);
  });

  it("focused model item gets highlight class", async () => {
    const wrapper = makeWrapper();
    await openDropdown(wrapper);
    const input = wrapper.find("input");
    await input.trigger("keydown", { key: "ArrowDown" });
    await wrapper.vm.$nextTick();
    const firstItem = wrapper.find('[data-model-index="0"]');
    expect(firstItem.classes()).toContain("bg-[var(--bg-active)]");
  });
});
