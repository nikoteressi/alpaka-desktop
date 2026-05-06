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

describe("HostSettings — addHost", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  it("calls hostStore.addHost with trimmed name and url then clears inputs", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "add_host") return Promise.resolve("host-new");
      if (cmd === "list_hosts") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    const { useHostStore } = await import("../../stores/hosts");
    const hostStore = useHostStore();
    const addSpy = vi.spyOn(hostStore, "addHost").mockResolvedValue();

    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    await wrapper.find('[data-testid="hosts-expand-btn"]').trigger("click");

    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("  My Server  ");
    await inputs[1].setValue("  http://192.168.1.100:11434  ");

    const addBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Add Host"));
    await addBtn!.trigger("click");
    await wrapper.vm.$nextTick();

    expect(addSpy).toHaveBeenCalledWith(
      "My Server",
      "http://192.168.1.100:11434",
    );

    const vm = wrapper.vm as unknown as {
      newHostName: string;
      newHostUrl: string;
    };
    expect(vm.newHostName).toBe("");
    expect(vm.newHostUrl).toBe("");
  });

  it("addHost is a no-op when name is whitespace-only", async () => {
    const { useHostStore } = await import("../../stores/hosts");
    const hostStore = useHostStore();
    const addSpy = vi.spyOn(hostStore, "addHost").mockResolvedValue();

    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    const vm = wrapper.vm as unknown as {
      newHostName: string;
      newHostUrl: string;
      addHost: () => Promise<void>;
    };
    vm.newHostName = "   ";
    vm.newHostUrl = "http://192.168.1.100:11434";
    await vm.addHost();

    expect(addSpy).not.toHaveBeenCalled();
  });
});

describe("HostSettings — confirmDelete", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  async function mountWithHost(isActive: boolean) {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") {
        return Promise.resolve([
          {
            id: "host-1",
            name: "Remote",
            url: "http://remote:11434",
            is_active: isActive,
            last_ping_status: "online",
          },
        ]);
      }
      return Promise.resolve(undefined);
    });
    setActivePinia(createPinia());
    const { useHostStore } = await import("../../stores/hosts");
    const store = useHostStore();
    await store.fetchHosts();
    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    await wrapper.find('[data-testid="hosts-expand-btn"]').trigger("click");
    await wrapper.vm.$nextTick();
    return { wrapper, store };
  }

  it("opens info modal (hideCancel) when attempting to delete the active host", async () => {
    const { wrapper } = await mountWithHost(true);
    const vm = wrapper.vm as unknown as {
      confirmDelete: (id: string, isActive: boolean) => void;
      modal: { show: boolean; kind: string; hideCancel: boolean };
    };

    vm.confirmDelete("host-1", true);
    await wrapper.vm.$nextTick();

    expect(vm.modal.show).toBe(true);
    expect(vm.modal.kind).toBe("info");
    expect(vm.modal.hideCancel).toBe(true);
  });

  it("opens danger modal when deleting an inactive host", async () => {
    const { wrapper } = await mountWithHost(false);
    const vm = wrapper.vm as unknown as {
      confirmDelete: (id: string, isActive: boolean) => void;
      modal: { show: boolean; kind: string };
    };

    vm.confirmDelete("host-1", false);
    await wrapper.vm.$nextTick();

    expect(vm.modal.show).toBe(true);
    expect(vm.modal.kind).toBe("danger");
  });

  it("confirming danger modal calls hostStore.deleteHost with the correct id", async () => {
    const { wrapper, store } = await mountWithHost(false);
    const deleteSpy = vi.spyOn(store, "deleteHost").mockResolvedValue();

    const vm = wrapper.vm as unknown as {
      confirmDelete: (id: string, isActive: boolean) => void;
      onConfirm: () => void;
    };

    vm.confirmDelete("host-1", false);
    await wrapper.vm.$nextTick();

    vm.onConfirm();
    await wrapper.vm.$nextTick();

    expect(deleteSpy).toHaveBeenCalledWith("host-1");
  });

  it("confirming info modal (active host) does NOT call deleteHost", async () => {
    const { wrapper, store } = await mountWithHost(true);
    const deleteSpy = vi.spyOn(store, "deleteHost").mockResolvedValue();

    const vm = wrapper.vm as unknown as {
      confirmDelete: (id: string, isActive: boolean) => void;
      onConfirm: () => void;
    };

    vm.confirmDelete("host-1", true);
    await wrapper.vm.$nextTick();
    vm.onConfirm();

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});

describe("HostSettings — Connect button / status indicators", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  it("shows Connect button only for inactive hosts", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") {
        return Promise.resolve([
          {
            id: "host-1",
            name: "Active",
            url: "http://active:11434",
            is_active: true,
            last_ping_status: "online",
          },
          {
            id: "host-2",
            name: "Inactive",
            url: "http://inactive:11434",
            is_active: false,
            last_ping_status: "offline",
          },
        ]);
      }
      return Promise.resolve(undefined);
    });
    setActivePinia(createPinia());
    const { useHostStore } = await import("../../stores/hosts");
    await useHostStore().fetchHosts();

    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    await wrapper.find('[data-testid="hosts-expand-btn"]').trigger("click");
    await wrapper.vm.$nextTick();

    const connectBtns = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Connect");
    // Only the inactive host should have a Connect button
    expect(connectBtns).toHaveLength(1);
  });

  it("status indicator uses success class for online host", async () => {
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
    setActivePinia(createPinia());
    const { useHostStore } = await import("../../stores/hosts");
    await useHostStore().fetchHosts();

    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    await wrapper.find('[data-testid="hosts-expand-btn"]').trigger("click");
    await wrapper.vm.$nextTick();

    const dot = wrapper.find('[data-testid="host-status"]');
    expect(dot.classes()).toContain("bg-[var(--success)]");
  });

  it("status indicator uses danger class for offline host", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") {
        return Promise.resolve([
          {
            id: "host-2",
            name: "Remote",
            url: "http://remote:11434",
            is_active: false,
            last_ping_status: "offline",
          },
        ]);
      }
      return Promise.resolve(undefined);
    });
    setActivePinia(createPinia());
    const { useHostStore } = await import("../../stores/hosts");
    await useHostStore().fetchHosts();

    const wrapper = mount(HostSettings, {
      global: { stubs: { ConfirmationModal: ConfirmationModalStub } },
    });
    await wrapper.find('[data-testid="hosts-expand-btn"]').trigger("click");
    await wrapper.vm.$nextTick();

    const dot = wrapper.find('[data-testid="host-status"]');
    expect(dot.classes()).toContain("bg-[var(--danger)]");
  });
});
