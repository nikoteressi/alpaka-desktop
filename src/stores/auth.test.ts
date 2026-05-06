import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAuthStore } from "./auth";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => mockInvoke(cmd, args),
}));

describe("useAuthStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("login updates user and authenticated status", async () => {
    const authStore = useAuthStore();

    mockInvoke.mockResolvedValueOnce(null); // login
    mockInvoke.mockResolvedValueOnce(true); // get_auth_status
    mockInvoke.mockResolvedValueOnce({
      name: "nikoteressi",
      email: "user@example.com",
    }); // get_ollama_user_profile

    await authStore.login("host1", "token123");

    expect(mockInvoke).toHaveBeenCalledWith("login", {
      hostId: "host1",
      token: "token123",
    });
    expect(mockInvoke).toHaveBeenCalledWith("get_auth_status", {
      hostId: "host1",
    });
    expect(authStore.authenticatedHosts["host1"]).toBe(true);
    // username is populated asynchronously from the profile fetch
    expect(authStore.user).not.toBeNull();
  });

  it("logout clears authenticated status and user if no hosts left", async () => {
    const authStore = useAuthStore();
    authStore.authenticatedHosts = { host1: true };
    authStore.user = { id: "user1", username: "testuser" };

    mockInvoke.mockResolvedValue(null);

    await authStore.logout("host1");

    expect(mockInvoke).toHaveBeenCalledWith("logout", { hostId: "host1" });
    expect(authStore.authenticatedHosts["host1"]).toBe(false);
    expect(authStore.user).toBeNull();
  });
});

describe("API key management", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("loadApiKeyStatus sets apiKeyStatus to not_set", async () => {
    mockInvoke.mockResolvedValueOnce("not_set");
    const store = useAuthStore();
    await store.loadApiKeyStatus();
    expect(store.apiKeyStatus).toBe("not_set");
  });

  it("loadApiKeyStatus sets apiKeyStatus to set when key exists", async () => {
    mockInvoke.mockResolvedValueOnce("set");
    const store = useAuthStore();
    await store.loadApiKeyStatus();
    expect(store.apiKeyStatus).toBe("set");
  });

  it("loadApiKeyStatus falls back to unknown on error", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("keyring error"));
    const store = useAuthStore();
    await store.loadApiKeyStatus();
    expect(store.apiKeyStatus).toBe("unknown");
  });

  it("saveApiKey calls set_api_key and sets status to set", async () => {
    mockInvoke.mockResolvedValueOnce(undefined); // set_api_key
    const store = useAuthStore();
    await store.saveApiKey("sk-test-key-abc");
    expect(mockInvoke).toHaveBeenCalledWith("set_api_key", {
      key: "sk-test-key-abc",
    });
    expect(store.apiKeyStatus).toBe("set");
  });

  it("removeApiKey calls delete_api_key and sets status to not_set", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    const store = useAuthStore();
    store.apiKeyStatus = "set";
    await store.removeApiKey();
    expect(mockInvoke).toHaveBeenCalledWith("delete_api_key", undefined);
    expect(store.apiKeyStatus).toBe("not_set");
  });

  it("validateApiKey sets checking then valid on true response", async () => {
    let resolve!: (v: boolean) => void;
    mockInvoke.mockReturnValueOnce(
      new Promise<boolean>((r) => {
        resolve = r;
      }),
    );
    const store = useAuthStore();
    const p = store.validateApiKey("host-uuid-1");
    expect(store.apiKeyStatus).toBe("checking");
    resolve(true);
    const result = await p;
    expect(result).toBe(true);
    expect(store.apiKeyStatus).toBe("valid");
  });

  it("validateApiKey sets invalid on false response", async () => {
    mockInvoke.mockResolvedValueOnce(false);
    const store = useAuthStore();
    const result = await store.validateApiKey("host-uuid-1");
    expect(result).toBe(false);
    expect(store.apiKeyStatus).toBe("invalid");
  });

  it("validateApiKey sets unknown on network error", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("network error"));
    const store = useAuthStore();
    const result = await store.validateApiKey("host-uuid-1");
    expect(result).toBe(false);
    expect(store.apiKeyStatus).toBe("unknown");
  });
});
