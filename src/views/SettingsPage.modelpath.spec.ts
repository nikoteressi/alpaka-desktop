/**
 * SettingsPage — Model storage path feature (MO-08)
 *
 * Tests the watch-based validation flow and the applyModelPath / browseModelPath
 * functions that live inside <script setup>.  All Tauri IPC is intercepted via
 * the module-level mockInvoke, and fake timers advance the debounce delays.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import SettingsPage from "./SettingsPage.vue";
import { useSettingsStore } from "../stores/settings";
import { useHostStore } from "../stores/hosts";
import type { Host } from "../types/hosts";

// ── Module-level mocks ────────────────────────────────────────────────────────

const mockInvoke = vi.fn();
const mockOpen = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: Record<string, unknown>) =>
    mockInvoke(cmd, args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => mockOpen(...args),
}));

// Stub heavy child components that have their own Tauri / store dependencies
vi.mock("../components/settings/HostSettings.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../components/shared/AppTabs.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../components/settings/AccountSettings.vue", () => ({
  default: { template: "<div />" },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHost(
  overrides: Partial<Host> & { id: string; url: string },
): Host {
  const url = overrides.url;
  const kind: "local" | "cloud" = url.includes("api.ollama.com")
    ? "cloud"
    : "local";
  return {
    name: "local",
    kind,
    is_default: true,
    is_active: true,
    last_ping_status: "online",
    last_ping_at: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Mount SettingsPage against the active Pinia (set in beforeEach). */
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

// Internal-ref shape exposed through wrapper.vm proxy
interface SettingsPageVM {
  applyModelPath: (path: string) => Promise<void>;
  browseModelPath: () => Promise<void>;
  pathValidation: { status: string; message: string; modelCount: number };
  pathApply: { status: string; message: string };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SettingsPage — model path validation (watch)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockOpen.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("empty modelPath → pathValidation.status is 'idle' (no invoke)", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.modelPath = ""; // ensure empty before mount

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    expect(vm.pathValidation.status).toBe("idle");
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "validate_model_path",
      expect.anything(),
    );
  });

  it("non-existent path → status 'error', message contains 'does not exist'", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.modelPath = ""; // start empty so mount watch fires idle

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "validate_model_path") {
        return Promise.resolve({
          exists: false,
          accessible: false,
          model_count: 0,
          resolved_path: "/bad/path",
        });
      }
      return Promise.resolve([]);
    });

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    // Now trigger the watch by setting a path
    settingsStore.modelPath = "/bad/path";
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    expect(vm.pathValidation.status).toBe("checking");

    // Advance past the 500 ms debounce
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();

    expect(vm.pathValidation.status).toBe("error");
    expect(vm.pathValidation.message).toContain("does not exist");
  });

  it("inaccessible path → status 'warning', message contains 'elevated access'", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.modelPath = "";

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "validate_model_path") {
        return Promise.resolve({
          exists: true,
          accessible: false,
          model_count: 0,
          resolved_path: "/sys/path",
        });
      }
      return Promise.resolve([]);
    });

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    settingsStore.modelPath = "/sys/path";
    await wrapper.vm.$nextTick();
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    expect(vm.pathValidation.status).toBe("warning");
    expect(vm.pathValidation.message).toContain("elevated access");
  });

  it("accessible path with 0 models → status 'warning', message contains 'No Ollama models'", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.modelPath = "";

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "validate_model_path") {
        return Promise.resolve({
          exists: true,
          accessible: true,
          model_count: 0,
          resolved_path: "/empty/path",
        });
      }
      return Promise.resolve([]);
    });

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    settingsStore.modelPath = "/empty/path";
    await wrapper.vm.$nextTick();
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    expect(vm.pathValidation.status).toBe("warning");
    expect(vm.pathValidation.message).toContain("No Ollama models");
  });

  it("accessible path with 3 models → status 'ok', message = 'Found 3 model(s)'", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.modelPath = "";

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "validate_model_path") {
        return Promise.resolve({
          exists: true,
          accessible: true,
          model_count: 3,
          resolved_path: "/good/path",
        });
      }
      return Promise.resolve([]);
    });

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    settingsStore.modelPath = "/good/path";
    await wrapper.vm.$nextTick();
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    expect(vm.pathValidation.status).toBe("ok");
    expect(vm.pathValidation.message).toBe("Found 3 model(s)");
  });

  it("validate_model_path throws → status 'error', message = 'Validation failed'", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.modelPath = "";

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "validate_model_path") {
        return Promise.reject(new Error("IPC error"));
      }
      return Promise.resolve([]);
    });

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    settingsStore.modelPath = "/some/path";
    await wrapper.vm.$nextTick();
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    expect(vm.pathValidation.status).toBe("error");
    expect(vm.pathValidation.message).toBe("Validation failed");
  });
});

describe("SettingsPage — applyModelPath", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockOpen.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("user/system service success → pathApply.status = 'success'", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "apply_model_path") {
        return Promise.resolve({
          service_type: "user",
          applied: true,
          restarted: false,
          message: "Done",
        });
      }
      return Promise.resolve([]);
    });

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    await vm.applyModelPath("/some/path");
    await wrapper.vm.$nextTick();

    expect(vm.pathApply.status).toBe("success");
    expect(vm.pathApply.message).toBe("Done");
  });

  it("service_type 'none' → pathApply.status = 'manual'", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "apply_model_path") {
        return Promise.resolve({
          service_type: "none",
          applied: false,
          restarted: false,
          message: "Restart manually",
        });
      }
      return Promise.resolve([]);
    });

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    await vm.applyModelPath("/some/path");
    await wrapper.vm.$nextTick();

    expect(vm.pathApply.status).toBe("manual");
    expect(vm.pathApply.message).toBe("Restart manually");
  });

  it("restarted + active host is cloud → setActiveHost called with local host id", async () => {
    const cloudHost = makeHost({
      id: "cloud-1",
      url: "https://api.ollama.com",
      is_active: true,
    });
    const localHost = makeHost({
      id: "local-1",
      url: "http://localhost:11434",
      is_active: false,
    });

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "apply_model_path") {
        return Promise.resolve({
          service_type: "user",
          applied: true,
          restarted: true,
          message: "Restarted",
        });
      }
      if (cmd === "list_hosts") {
        return Promise.resolve([
          { ...cloudHost, is_active: true },
          { ...localHost, is_active: false },
        ]);
      }
      if (cmd === "set_active_host") {
        return Promise.resolve(undefined);
      }
      if (cmd === "list_models") {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    // Pre-populate the host store so activeHost resolves to the cloud host before fetchHosts runs
    const hostStore = useHostStore();
    hostStore.hosts = [cloudHost, localHost];
    hostStore.activeHostId = "cloud-1";

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    await vm.applyModelPath("/some/path");
    await wrapper.vm.$nextTick();

    // Advance the 2000ms restart timer (contains ensureLocalHost + fetchModels)
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();

    expect(mockInvoke).toHaveBeenCalledWith("set_active_host", {
      id: "local-1",
    });
  });

  it("apply_model_path throws Error → pathApply.status = 'error', message from Error.message", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "apply_model_path") {
        return Promise.reject(new Error("Permission denied"));
      }
      return Promise.resolve([]);
    });

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    await vm.applyModelPath("/some/path");
    await wrapper.vm.$nextTick();

    expect(vm.pathApply.status).toBe("error");
    expect(vm.pathApply.message).toBe("Permission denied");
  });

  it("apply_model_path throws plain string → pathApply.status = 'error', message is that string", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "apply_model_path") {
        return Promise.reject("disk full");
      }
      return Promise.resolve([]);
    });

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    await vm.applyModelPath("/some/path");
    await wrapper.vm.$nextTick();

    expect(vm.pathApply.status).toBe("error");
    expect(vm.pathApply.message).toBe("disk full");
  });
});

describe("SettingsPage — browseModelPath", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockOpen.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("dialog returns a path → settingsStore.modelPath updated and applyModelPath called", async () => {
    mockOpen.mockResolvedValue("/chosen/path");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "apply_model_path") {
        return Promise.resolve({
          service_type: "user",
          applied: true,
          restarted: false,
          message: "OK",
        });
      }
      return Promise.resolve([]);
    });

    const settingsStore = useSettingsStore();
    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    await vm.browseModelPath();
    await wrapper.vm.$nextTick();

    expect(settingsStore.modelPath).toBe("/chosen/path");
    expect(mockInvoke).toHaveBeenCalledWith("apply_model_path", {
      path: "/chosen/path",
    });
    expect(vm.pathApply.status).toBe("success");
  });

  it("dialog returns null (cancelled) → applyModelPath is NOT called", async () => {
    mockOpen.mockResolvedValue(null);

    const wrapper = mountPage();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as SettingsPageVM;
    await vm.browseModelPath();
    await wrapper.vm.$nextTick();

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "apply_model_path",
      expect.anything(),
    );
  });
});
