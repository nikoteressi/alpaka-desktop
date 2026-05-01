import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useHostStore } from "./hosts";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => mockInvoke(cmd, args),
}));

const mockListen = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, cb: (e: unknown) => void) => mockListen(event, cb),
}));

const makeHost = (
  overrides: Partial<{
    id: string;
    name: string;
    url: string;
    is_default: boolean;
    is_active: boolean;
    last_ping_status: "online" | "offline" | "unknown";
    last_ping_at: string | null;
    created_at: string;
  }> = {},
) => ({
  id: "1",
  name: "Local",
  url: "",
  is_default: true,
  is_active: true,
  last_ping_status: "online" as const,
  last_ping_at: null,
  created_at: "",
  ...overrides,
});

describe("useHostStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
    mockListen.mockReset();

    const hostStore = useHostStore();
    hostStore.hosts = [
      makeHost({ id: "1", name: "Local", is_default: true, is_active: true }),
      makeHost({
        id: "2",
        name: "Remote",
        is_default: false,
        is_active: false,
      }),
    ];
    hostStore.activeHostId = "1";
  });

  it("setActiveHost switches host", async () => {
    const hostStore = useHostStore();

    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "set_active_host") return;
      if (cmd === "list_hosts")
        return [
          makeHost({ id: "1", is_active: false }),
          makeHost({
            id: "2",
            name: "Remote",
            is_default: false,
            is_active: true,
          }),
        ];
      return null;
    });

    await hostStore.setActiveHost("2");

    expect(mockInvoke).toHaveBeenCalledWith("set_active_host", { id: "2" });
    expect(hostStore.activeHostId).toBe("2");
  });

  it("setActiveHost is a no-op when host is already active", async () => {
    const hostStore = useHostStore();
    await hostStore.setActiveHost("1");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("setActiveHost logs error on failure", async () => {
    const hostStore = useHostStore();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInvoke.mockRejectedValueOnce(new Error("network error"));

    await hostStore.setActiveHost("2");

    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("fetchHosts loads hosts and sets activeHostId from is_active flag", async () => {
    const hostStore = useHostStore();
    hostStore.hosts = [];
    hostStore.activeHostId = null;

    mockInvoke.mockResolvedValueOnce([
      makeHost({ id: "10", is_active: false }),
      makeHost({ id: "20", name: "Active", is_active: true }),
    ]);

    await hostStore.fetchHosts();

    expect(hostStore.hosts).toHaveLength(2);
    expect(hostStore.activeHostId).toBe("20");
  });

  it("fetchHosts logs error on failure", async () => {
    const hostStore = useHostStore();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInvoke.mockRejectedValueOnce(new Error("db error"));

    await hostStore.fetchHosts();

    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("addHost invokes add_host and refreshes list", async () => {
    const hostStore = useHostStore();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "list_hosts") return [makeHost({ id: "99", name: "New" })];
      return null;
    });

    await hostStore.addHost("New", "http://new.local");

    expect(mockInvoke).toHaveBeenCalledWith("add_host", {
      newHost: { name: "New", url: "http://new.local", is_default: false },
    });
    expect(hostStore.hosts[0].name).toBe("New");
  });

  it("addHost logs error on failure", async () => {
    const hostStore = useHostStore();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInvoke.mockRejectedValueOnce(new Error("add failed"));

    await hostStore.addHost("Bad", "http://bad");

    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("updateHost invokes update_host and refreshes list", async () => {
    const hostStore = useHostStore();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "list_hosts") return [makeHost({ id: "1", name: "Updated" })];
      return null;
    });

    await hostStore.updateHost("1", "Updated", "http://updated.local");

    expect(mockInvoke).toHaveBeenCalledWith("update_host", {
      id: "1",
      name: "Updated",
      url: "http://updated.local",
    });
  });

  it("updateHost logs error on failure", async () => {
    const hostStore = useHostStore();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInvoke.mockRejectedValueOnce(new Error("update failed"));

    await hostStore.updateHost("1", "X", "http://x");

    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("deleteHost invokes delete_host and refreshes list", async () => {
    const hostStore = useHostStore();
    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "list_hosts") return [];
      return null;
    });

    await hostStore.deleteHost("1");

    expect(mockInvoke).toHaveBeenCalledWith("delete_host", { id: "1" });
    expect(hostStore.hosts).toHaveLength(0);
  });

  it("deleteHost logs error on failure", async () => {
    const hostStore = useHostStore();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInvoke.mockRejectedValueOnce(new Error("delete failed"));

    await hostStore.deleteHost("1");

    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("activeHost getter returns the host matching activeHostId", () => {
    const hostStore = useHostStore();
    expect(hostStore.activeHost?.id).toBe("1");
  });

  it("activeHost getter returns null when activeHostId is not set", () => {
    const hostStore = useHostStore();
    hostStore.activeHostId = null;
    expect(hostStore.activeHost).toBeNull();
  });

  describe("initListeners", () => {
    it("registers host:status-change listener and sets listenersInitialized", async () => {
      const hostStore = useHostStore();
      await hostStore.initListeners();

      expect(mockListen).toHaveBeenCalledWith(
        "host:status-change",
        expect.any(Function),
      );
      expect(hostStore.listenersInitialized).toBe(true);
    });

    it("does not register listener a second time", async () => {
      const hostStore = useHostStore();
      await hostStore.initListeners();
      await hostStore.initListeners();

      expect(mockListen).toHaveBeenCalledTimes(1);
    });

    it("updates host status when host:status-change event fires", async () => {
      const hostStore = useHostStore();
      let capturedCb: ((e: unknown) => void) | null = null;
      mockListen.mockImplementation(
        (_event: string, cb: (e: unknown) => void) => {
          capturedCb = cb;
        },
      );

      await hostStore.initListeners();
      expect(capturedCb).not.toBeNull();

      capturedCb!({
        payload: { host_id: "1", status: "offline", latency_ms: null },
      });

      expect(hostStore.hosts[0].last_ping_status).toBe("offline");
      expect(hostStore.hosts[0].last_ping_at).not.toBeNull();
    });

    it("ignores status-change for unknown host id", async () => {
      const hostStore = useHostStore();
      let capturedCb: ((e: unknown) => void) | null = null;
      mockListen.mockImplementation(
        (_event: string, cb: (e: unknown) => void) => {
          capturedCb = cb;
        },
      );

      await hostStore.initListeners();
      const originalHosts = JSON.parse(JSON.stringify(hostStore.hosts));

      capturedCb!({
        payload: { host_id: "999", status: "offline", latency_ms: null },
      });

      expect(hostStore.hosts[0].last_ping_status).toBe(
        originalHosts[0].last_ping_status,
      );
    });
  });
});
