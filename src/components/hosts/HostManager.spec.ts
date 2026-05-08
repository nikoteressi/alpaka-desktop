import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import HostManager from "./HostManager.vue";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("../../composables/useAppOrchestration", () => ({
  useAppOrchestration: () => ({ switchHost: vi.fn() }),
}));

const BaseModalStub = {
  name: "BaseModal",
  template: "<div v-if='show'><slot /></div>",
  props: ["show", "title", "maxWidth"],
  emits: ["close"],
};

const ConfirmationModalStub = {
  name: "ConfirmationModal",
  template: "<div />",
  props: ["show", "title", "message", "confirmLabel", "kind", "hideCancel"],
  emits: ["confirm", "cancel"],
};

const CustomTooltipStub = {
  name: "CustomTooltip",
  template: "<span><slot /></span>",
  props: ["text", "wrapperClass"],
};

const stubs = {
  BaseModal: BaseModalStub,
  ConfirmationModal: ConfirmationModalStub,
  CustomTooltip: CustomTooltipStub,
};

async function mountOpen() {
  const wrapper = mount(HostManager, { global: { stubs } });
  const { useHostStore } = await import("../../stores/hosts");
  useHostStore().isHostManagerOpen = true;
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe("HostManager", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  it("renders without errors", () => {
    const wrapper = mount(HostManager, { global: { stubs } });
    expect(wrapper.exists()).toBe(true);
  });

  it("shows nothing when modal is closed", () => {
    const wrapper = mount(HostManager, { global: { stubs } });
    expect(wrapper.text()).not.toContain("Add New Host");
  });

  it("shows Add New Host section when modal is open", async () => {
    const wrapper = await mountOpen();
    expect(wrapper.text()).toContain("Add New Host");
  });

  it("shows 'No hosts configured' when host list is empty", async () => {
    const wrapper = await mountOpen();
    expect(wrapper.text()).toContain("No hosts configured");
  });

  it("renders host name and url when hosts are present", async () => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts")
        return Promise.resolve([
          {
            id: "h1",
            name: "Local",
            url: "http://localhost:11434",
            is_active: true,
            last_ping_status: "online",
          },
        ]);
      return Promise.resolve(undefined);
    });
    const { useHostStore } = await import("../../stores/hosts");
    const store = useHostStore();
    await store.fetchHosts();
    store.isHostManagerOpen = true;

    const wrapper = mount(HostManager, { global: { stubs } });
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Local");
    expect(wrapper.find('[data-testid="host-url"]').text()).toBe(
      "http://localhost:11434",
    );
  });

  it("shows Connect button only for inactive hosts", async () => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts")
        return Promise.resolve([
          {
            id: "h1",
            name: "Active",
            url: "http://a:11434",
            is_active: true,
            last_ping_status: "online",
          },
          {
            id: "h2",
            name: "Inactive",
            url: "http://b:11434",
            is_active: false,
            last_ping_status: "offline",
          },
        ]);
      return Promise.resolve(undefined);
    });
    const { useHostStore } = await import("../../stores/hosts");
    const store = useHostStore();
    await store.fetchHosts();
    store.isHostManagerOpen = true;

    const wrapper = mount(HostManager, { global: { stubs } });
    await wrapper.vm.$nextTick();

    const connectBtns = wrapper
      .findAll("button")
      .filter((b) => b.text() === "Connect");
    expect(connectBtns).toHaveLength(1);
  });

  it("status dot uses success class for online host", async () => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts")
        return Promise.resolve([
          {
            id: "h1",
            name: "Local",
            url: "http://localhost:11434",
            is_active: true,
            last_ping_status: "online",
          },
        ]);
      return Promise.resolve(undefined);
    });
    const { useHostStore } = await import("../../stores/hosts");
    const store = useHostStore();
    await store.fetchHosts();
    store.isHostManagerOpen = true;

    const wrapper = mount(HostManager, { global: { stubs } });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="host-status"]').classes()).toContain(
      "bg-[var(--success)]",
    );
  });

  it("status dot uses danger class for offline host", async () => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts")
        return Promise.resolve([
          {
            id: "h1",
            name: "Remote",
            url: "http://r:11434",
            is_active: false,
            last_ping_status: "offline",
          },
        ]);
      return Promise.resolve(undefined);
    });
    const { useHostStore } = await import("../../stores/hosts");
    const store = useHostStore();
    await store.fetchHosts();
    store.isHostManagerOpen = true;

    const wrapper = mount(HostManager, { global: { stubs } });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="host-status"]').classes()).toContain(
      "bg-[var(--danger)]",
    );
  });

  it("Add Host button is disabled when inputs are empty", async () => {
    const wrapper = await mountOpen();
    const addBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Add Host"));
    expect(addBtn!.attributes("disabled")).toBeDefined();
  });

  it("Add Host button is enabled when both inputs are filled", async () => {
    const wrapper = await mountOpen();
    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("My Server");
    await inputs[1].setValue("http://192.168.1.100:11434");
    const addBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Add Host"));
    expect(addBtn!.attributes("disabled")).toBeUndefined();
  });
});

describe("HostManager — addHost", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  it("calls hostStore.addHost with trimmed values and clears inputs", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "add_host") return Promise.resolve("h-new");
      if (cmd === "list_hosts") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    const { useHostStore } = await import("../../stores/hosts");
    const store = useHostStore();
    const addSpy = vi.spyOn(store, "addHost").mockResolvedValue();
    store.isHostManagerOpen = true;

    const wrapper = mount(HostManager, { global: { stubs } });
    await wrapper.vm.$nextTick();

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
    const store = useHostStore();
    const addSpy = vi.spyOn(store, "addHost").mockResolvedValue();
    store.isHostManagerOpen = true;

    const wrapper = mount(HostManager, { global: { stubs } });
    await wrapper.vm.$nextTick();

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

describe("HostManager — confirmDelete", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  async function mountWithHost(isActive: boolean) {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts")
        return Promise.resolve([
          {
            id: "h1",
            name: "Remote",
            url: "http://r:11434",
            is_active: isActive,
            last_ping_status: "online",
          },
        ]);
      return Promise.resolve(undefined);
    });
    setActivePinia(createPinia());
    const { useHostStore } = await import("../../stores/hosts");
    const store = useHostStore();
    await store.fetchHosts();
    store.isHostManagerOpen = true;
    const wrapper = mount(HostManager, { global: { stubs } });
    await wrapper.vm.$nextTick();
    return { wrapper, store };
  }

  it("opens info modal when attempting to delete the active host", async () => {
    const { wrapper } = await mountWithHost(true);
    const vm = wrapper.vm as unknown as {
      confirmDelete: (id: string, isActive: boolean) => void;
      modal: { show: boolean; kind: string; hideCancel: boolean };
    };

    vm.confirmDelete("h1", true);
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

    vm.confirmDelete("h1", false);
    await wrapper.vm.$nextTick();

    expect(vm.modal.show).toBe(true);
    expect(vm.modal.kind).toBe("danger");
  });

  it("confirming danger modal calls hostStore.deleteHost with correct id", async () => {
    const { wrapper, store } = await mountWithHost(false);
    const deleteSpy = vi.spyOn(store, "deleteHost").mockResolvedValue();

    const vm = wrapper.vm as unknown as {
      confirmDelete: (id: string, isActive: boolean) => void;
      onConfirm: () => void;
    };

    vm.confirmDelete("h1", false);
    await wrapper.vm.$nextTick();
    vm.onConfirm();
    await wrapper.vm.$nextTick();

    expect(deleteSpy).toHaveBeenCalledWith("h1");
  });

  it("confirming info modal (active host) does NOT call deleteHost", async () => {
    const { wrapper, store } = await mountWithHost(true);
    const deleteSpy = vi.spyOn(store, "deleteHost").mockResolvedValue();

    const vm = wrapper.vm as unknown as {
      confirmDelete: (id: string, isActive: boolean) => void;
      onConfirm: () => void;
    };

    vm.confirmDelete("h1", true);
    await wrapper.vm.$nextTick();
    vm.onConfirm();

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
