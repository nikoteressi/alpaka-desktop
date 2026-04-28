import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useHostStore } from "./hosts";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => mockInvoke(cmd, args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

describe("useHostStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();

    const hostStore = useHostStore();
    hostStore.hosts = [
      {
        id: "1",
        name: "Local",
        url: "",
        is_default: true,
        is_active: true,
        last_ping_status: "online",
        last_ping_at: null,
        created_at: "",
      },
      {
        id: "2",
        name: "Remote",
        url: "",
        is_default: false,
        is_active: false,
        last_ping_status: "online",
        last_ping_at: null,
        created_at: "",
      },
    ];
    hostStore.activeHostId = "1";
  });

  it("setActiveHost switches host", async () => {
    const hostStore = useHostStore();

    mockInvoke.mockImplementation(async (cmd) => {
      if (cmd === "set_active_host") return;
      if (cmd === "list_hosts")
        return [
          {
            id: "1",
            name: "Local",
            url: "",
            is_default: true,
            is_active: false,
            last_ping_status: "online",
            last_ping_at: null,
            created_at: "",
          },
          {
            id: "2",
            name: "Remote",
            url: "",
            is_default: false,
            is_active: true,
            last_ping_status: "online",
            last_ping_at: null,
            created_at: "",
          },
        ];
      return null;
    });

    await hostStore.setActiveHost("2");

    expect(mockInvoke).toHaveBeenCalledWith("set_active_host", { id: "2" });
    expect(hostStore.activeHostId).toBe("2");
  });
});
