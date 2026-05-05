import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createRouter, createMemoryHistory } from "vue-router";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

import SettingsPage from "./SettingsPage.vue";

const globalStubs = {
  GeneralTab: true,
  ConnectivityTab: true,
  ModelsTab: true,
  PromptsTab: true,
  AccountTab: true,
  MaintenanceTab: true,
  AdvancedTab: true,
  AppTabs: {
    name: "AppTabs",
    template: "<div><slot /></div>",
    props: ["modelValue", "tabs"],
    emits: ["update:modelValue"],
  },
  Transition: { template: "<div><slot /></div>" },
};

describe("SettingsPage — query-param tab routing", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("mounts without crashing with all tab components stubbed", async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: { template: "<div />" } }] });
    await router.push("/");
    await router.isReady();

    const wrapper = mount(SettingsPage, {
      global: { stubs: globalStubs, plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.exists()).toBe(true);
  });

  it("initializes activeTab to 'advanced' when route.query.tab = 'advanced'", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/settings", component: SettingsPage }],
    });
    await router.push({ path: "/settings", query: { tab: "advanced" } });
    await router.isReady();

    const wrapper = mount(SettingsPage, {
      global: { stubs: globalStubs, plugins: [router] },
    });
    await flushPromises();

    // When activeTab === 'advanced', AdvancedTab stub should be rendered
    expect(wrapper.findComponent({ name: "AdvancedTab" }).exists()).toBe(true);
  });

  it("activeTab stays 'general' when route.query.tab is absent", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/settings", component: SettingsPage }],
    });
    await router.push("/settings");
    await router.isReady();

    const wrapper = mount(SettingsPage, {
      global: { stubs: globalStubs, plugins: [router] },
    });
    await flushPromises();

    // When activeTab === 'general', GeneralTab stub should be rendered
    expect(wrapper.findComponent({ name: "GeneralTab" }).exists()).toBe(true);
    expect(wrapper.findComponent({ name: "AdvancedTab" }).exists()).toBe(false);
  });
});
