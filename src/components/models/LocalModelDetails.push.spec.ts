import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import LocalModelDetails from "./LocalModelDetails.vue";

const baseModel = {
  name: "llama3:8b",
  model: "llama3:8b",
  modified_at: "",
  size: 0,
  digest: "",
  details: {
    parent_model: "",
    format: "",
    family: "",
    parameter_size: "",
    quantization_level: "",
  },
};

describe("LocalModelDetails — Push to Cloud button", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("does NOT render push button for non-namespaced model", () => {
    const wrapper = mount(LocalModelDetails, {
      props: { model: { ...baseModel, name: "llama3:8b" } },
    });
    expect(wrapper.find("[data-testid='push-to-cloud-btn']").exists()).toBe(
      false,
    );
  });

  it("renders push button for namespaced model", () => {
    const wrapper = mount(LocalModelDetails, {
      props: { model: { ...baseModel, name: "myuser/mymodel:latest" } },
    });
    expect(wrapper.find("[data-testid='push-to-cloud-btn']").exists()).toBe(
      true,
    );
  });

  it("push button is disabled when not signed in", async () => {
    const wrapper = mount(LocalModelDetails, {
      props: { model: { ...baseModel, name: "myuser/mymodel:latest" } },
    });
    // isSignedIn defaults to false before mount resolves
    await wrapper.vm.$nextTick();
    const btn = wrapper.find("[data-testid='push-to-cloud-btn']");
    expect(btn.attributes("disabled")).toBeDefined();
  });
});
