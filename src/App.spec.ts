import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import App from "./App.vue";
import type { Host } from "./types/hosts";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => ({ path: "/chat", meta: {}, name: "chat" }),
  useRouter: () => ({ push: mockPush }),
  RouterView: { template: "<div data-testid='router-view' />" },
}));

vi.mock("./composables/useAppOrchestration", () => ({
  useAppOrchestration: () => ({ startNewChat: vi.fn(), init: vi.fn() }),
}));
vi.mock("./composables/useStreamingEvents", () => ({
  useStreamingEvents: () => ({ init: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("./composables/useCompactionEvents", () => ({
  useCompactionEvents: () => ({ init: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("./composables/useKeyboard", () => ({
  useKeyboard: () => ({ cleanup: vi.fn() }),
}));

const GLOBAL_STUBS = {
  ConversationList: { template: "<div />" },
  HostManager: { template: "<div />" },
  CustomTooltip: { template: "<slot />" },
};

function makeHost(status: "online" | "offline" | "unknown"): Host {
  return {
    id: "h1",
    name: "Local",
    url: "http://localhost:11434",
    kind: "local",
    is_active: true,
    is_default: true,
    last_ping_status: status,
    last_ping_at: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("App — ErrorScreen overlay", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });
  });

  it("does not show ErrorScreen when active host is online", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") return Promise.resolve([makeHost("online")]);
      return Promise.resolve(undefined);
    });

    const wrapper = mount(App, {
      global: { stubs: GLOBAL_STUBS },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="error-screen"]').exists()).toBe(false);
  });

  it("does not show ErrorScreen when status is unknown (initial state)", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") return Promise.resolve([makeHost("unknown")]);
      return Promise.resolve(undefined);
    });

    const wrapper = mount(App, {
      global: { stubs: GLOBAL_STUBS },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="error-screen"]').exists()).toBe(false);
  });

  it("shows ErrorScreen when active host is offline", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") return Promise.resolve([makeHost("offline")]);
      return Promise.resolve(undefined);
    });

    const wrapper = mount(App, {
      global: { stubs: GLOBAL_STUBS },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="error-screen"]').exists()).toBe(true);
  });

  it("retry handler calls ping_host with the active host id", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const mockInvoke = vi.mocked(invoke);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") return Promise.resolve([makeHost("offline")]);
      return Promise.resolve(undefined);
    });

    const wrapper = mount(App, {
      global: { stubs: GLOBAL_STUBS },
    });
    await flushPromises();

    const errorScreen = wrapper.findComponent({ name: "ErrorScreen" });
    await errorScreen.vm.$emit("retry");

    expect(mockInvoke).toHaveBeenCalledWith("ping_host", { id: "h1" });
  });

  it("openSettings handler navigates to /settings", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "list_hosts") return Promise.resolve([makeHost("offline")]);
      return Promise.resolve(undefined);
    });

    const wrapper = mount(App, {
      global: { stubs: GLOBAL_STUBS },
    });
    await flushPromises();

    const errorScreen = wrapper.findComponent({ name: "ErrorScreen" });
    await errorScreen.vm.$emit("openSettings");

    expect(mockPush).toHaveBeenCalledWith("/settings");
  });
});
