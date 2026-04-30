import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import SettingsPage from "./SettingsPage.vue";
import StopSequencesInput from "../components/settings/StopSequencesInput.vue";
import { useSettingsStore } from "../stores/settings";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) =>
    mockInvoke(cmd, args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

// Stub heavy components with their own store/IPC dependencies
vi.mock("../components/settings/HostSettings.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../components/settings/AccountSettings.vue", () => ({
  default: { template: "<div />" },
}));
// StopSequencesInput is tested separately; stub it here to isolate SettingsPage logic
vi.mock("../components/settings/StopSequencesInput.vue", () => ({
  default: {
    template: "<div data-testid='stop-sequences-input'></div>",
    props: ["modelValue"],
    emits: ["update:modelValue"],
  },
}));

// AppTabs is NOT mocked so the real component renders — this exercises the
// IconAdvanced setup() function which returns the gear SVG for the Advanced tab.

function mountPage() {
  return mount(SettingsPage, {
    global: {
      stubs: {
        SettingsRow: { template: "<div><slot name='control' /></div>" },
        ToggleSwitch: true,
        SettingsSlider: true,
        ConfirmationModal: true,
        Transition: { template: "<div><slot /></div>" },
      },
    },
  });
}

interface SettingsPageVM {
  activeTab: string;
}

describe("SettingsPage — Advanced tab (S-06 stop sequences)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("mounts with all 7 tabs rendered including Advanced", async () => {
    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    const tabButtons = wrapper.findAll("button.app-tab");
    const tabNames = tabButtons.map((b) => b.text());
    expect(tabNames.some((t) => t.includes("Advanced"))).toBe(true);
    expect(tabButtons.length).toBe(7);
  });

  it("Advanced tab section renders when activeTab is set to advanced", async () => {
    const wrapper = mountPage();
    const vm = wrapper.vm as unknown as SettingsPageVM;

    vm.activeTab = "advanced";
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".settings-card").exists()).toBe(true);
    expect(wrapper.text()).toContain("Stop Sequences");
    expect(wrapper.text()).toContain("Custom tokens that end generation early");
    expect(wrapper.find("[data-testid='stop-sequences-input']").exists()).toBe(
      true,
    );
  });

  it("StopSequencesInput receives stop sequences from store as modelValue", async () => {
    const store = useSettingsStore();
    store.chatOptions = { ...store.chatOptions, stop: ["###", "<END>"] };

    const wrapper = mountPage();
    const vm = wrapper.vm as unknown as SettingsPageVM;

    vm.activeTab = "advanced";
    await wrapper.vm.$nextTick();

    const input = wrapper.findComponent(StopSequencesInput);
    expect(input.props("modelValue")).toEqual(["###", "<END>"]);
  });

  it("update:modelValue with non-empty array calls updateChatOptions with that array", async () => {
    mockInvoke.mockResolvedValue(undefined);
    const store = useSettingsStore();

    const wrapper = mountPage();
    const vm = wrapper.vm as unknown as SettingsPageVM;

    vm.activeTab = "advanced";
    await wrapper.vm.$nextTick();

    const input = wrapper.findComponent(StopSequencesInput);
    await input.vm.$emit("update:modelValue", ["###"]);
    await wrapper.vm.$nextTick();

    expect(store.chatOptions.stop).toEqual(["###"]);
  });

  it("update:modelValue with empty array sets stop to undefined", async () => {
    mockInvoke.mockResolvedValue(undefined);
    const store = useSettingsStore();
    store.chatOptions = { ...store.chatOptions, stop: ["###"] };

    const wrapper = mountPage();
    const vm = wrapper.vm as unknown as SettingsPageVM;

    vm.activeTab = "advanced";
    await wrapper.vm.$nextTick();

    const input = wrapper.findComponent(StopSequencesInput);
    await input.vm.$emit("update:modelValue", []);
    await wrapper.vm.$nextTick();

    expect(store.chatOptions.stop).toBeUndefined();
  });
});

describe("SettingsPage — Engine Presets mirostat controls (S-08)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // The Presets editor (with MirostatSelector) lives in the 'models' tab ("Engine")
  async function mountPageOnEngine() {
    const wrapper = mountPage();
    const vm = wrapper.vm as unknown as { activeTab: string };
    vm.activeTab = "models";
    await wrapper.vm.$nextTick();
    return wrapper;
  }

  it("renders Sampling Mode selector with Off/Mirostat1/Mirostat2 buttons in preset editor", async () => {
    const wrapper = await mountPageOnEngine();

    const buttons = wrapper
      .findAll("button")
      .filter((b) => ["Off", "Mirostat 1", "Mirostat 2"].includes(b.text()));
    expect(buttons).toHaveLength(3);
  });

  it("updateLocalMirostat(1) sets localMirostat to 1", async () => {
    const wrapper = await mountPageOnEngine();
    const vm = wrapper.vm as unknown as {
      localMirostat: number;
      updateLocalMirostat: (v: 0 | 1 | 2) => void;
    };

    vm.updateLocalMirostat(1);
    await wrapper.vm.$nextTick();

    expect(vm.localMirostat).toBe(1);
  });

  it("updateLocalMirostat(2) sets localMirostat to 2", async () => {
    const wrapper = await mountPageOnEngine();
    const vm = wrapper.vm as unknown as {
      localMirostat: number;
      updateLocalMirostat: (v: 0 | 1 | 2) => void;
    };

    vm.updateLocalMirostat(2);
    await wrapper.vm.$nextTick();

    expect(vm.localMirostat).toBe(2);
  });

  it("updateLocalMirostat(0) resets localMirostat to 0", async () => {
    const wrapper = await mountPageOnEngine();
    const vm = wrapper.vm as unknown as {
      localMirostat: number;
      updateLocalMirostat: (v: 0 | 1 | 2) => void;
    };

    vm.updateLocalMirostat(2);
    await wrapper.vm.$nextTick();
    vm.updateLocalMirostat(0);
    await wrapper.vm.$nextTick();

    expect(vm.localMirostat).toBe(0);
  });

  it("localMirostat defaults to 0 when preset has no mirostat field", async () => {
    const wrapper = await mountPageOnEngine();
    const vm = wrapper.vm as unknown as { localMirostat: number };
    expect(vm.localMirostat).toBe(0);
  });
});
