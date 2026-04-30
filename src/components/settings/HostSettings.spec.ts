import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import HostSettings from "./HostSettings.vue";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../composables/useAppOrchestration", () => ({
  useAppOrchestration: () => ({
    switchHost: vi.fn(),
  }),
}));

const ConfirmationModalStub = {
  name: "ConfirmationModal",
  template: "<div />",
  props: ["show", "title", "message", "confirmLabel", "kind", "hideCancel"],
  emits: ["confirm", "cancel"],
};

describe("HostSettings", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  it("renders without errors", () => {
    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    expect(wrapper.exists()).toBe(true);
  });

  it("shows the hosts-expand-btn", () => {
    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    expect(wrapper.find('[data-testid="hosts-expand-btn"]').exists()).toBe(
      true,
    );
  });

  it("expands host panel when expand button is clicked", async () => {
    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    const expandBtn = wrapper.find('[data-testid="hosts-expand-btn"]');
    await expandBtn.trigger("click");
    expect(wrapper.text()).toContain("Add New Host");
  });

  it("shows host-status when hosts are present and panel is expanded", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") {
        return Promise.resolve([
          {
            id: "host-1",
            name: "Local",
            url: "http://localhost:11434",
            is_active: true,
            last_ping_status: "online",
          },
        ]);
      }
      return Promise.resolve(undefined);
    });

    // Re-init pinia so fetchHosts below picks up the mock above (beforeEach runs first with an empty mock)
    setActivePinia(createPinia());
    const { useHostStore } = await import("../../stores/hosts");
    const store = useHostStore();
    await store.fetchHosts();

    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    await wrapper.find('[data-testid="hosts-expand-btn"]').trigger("click");
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="host-status"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="host-url"]').exists()).toBe(true);
  });

  it("disables Add Host button when inputs are empty", async () => {
    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    await wrapper.find('[data-testid="hosts-expand-btn"]').trigger("click");
    const addBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Add Host"));
    expect(addBtn!.attributes("disabled")).toBeDefined();
  });

  it("enables Add Host button when both inputs are filled", async () => {
    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    await wrapper.find('[data-testid="hosts-expand-btn"]').trigger("click");

    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("My Server");
    await inputs[1].setValue("http://192.168.1.100:11434");

    const addBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Add Host"));
    expect(addBtn!.attributes("disabled")).toBeUndefined();
  });
});
