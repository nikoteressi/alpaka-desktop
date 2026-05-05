import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import CreateModelPage from "./CreateModelPage.vue";

describe("CreateModelPage — namespace naming hint", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("shows hint when name has no slash", async () => {
    const wrapper = mount(CreateModelPage, {
      props: { initialName: "", initialModelfile: "" },
    });
    const input = wrapper.find("#model-name-input");
    await input.setValue("myassistant");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='namespace-hint']").exists()).toBe(true);
  });

  it("does not show hint when name contains slash", async () => {
    const wrapper = mount(CreateModelPage, {
      props: { initialName: "", initialModelfile: "" },
    });
    const input = wrapper.find("#model-name-input");
    await input.setValue("myuser/myassistant");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='namespace-hint']").exists()).toBe(false);
  });

  it("does not show hint when name is empty", async () => {
    const wrapper = mount(CreateModelPage, {
      props: { initialName: "", initialModelfile: "" },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='namespace-hint']").exists()).toBe(false);
  });
});
