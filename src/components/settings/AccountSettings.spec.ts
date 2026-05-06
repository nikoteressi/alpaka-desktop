import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const { default: AccountSettings } = await import("./AccountSettings.vue");

describe("AccountSettings", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("calls checkAuthStatus on mount with active host id", async () => {
    const { useAuthStore } = await import("../../stores/auth");
    const { useHostStore } = await import("../../stores/hosts");

    const authStore = useAuthStore();
    const hostStore = useHostStore();
    hostStore.activeHostId = "host-42";

    const checkSpy = vi
      .spyOn(authStore, "checkAuthStatus")
      .mockResolvedValue(false);

    mount(AccountSettings);
    await flushPromises();

    expect(checkSpy).toHaveBeenCalledWith("host-42");
  });

  it("calls checkAuthStatus with 'default' when no active host is set", async () => {
    const { useAuthStore } = await import("../../stores/auth");
    const { useHostStore } = await import("../../stores/hosts");

    const authStore = useAuthStore();
    const hostStore = useHostStore();
    hostStore.activeHostId = null;

    const checkSpy = vi
      .spyOn(authStore, "checkAuthStatus")
      .mockResolvedValue(false);

    mount(AccountSettings);
    await flushPromises();

    expect(checkSpy).toHaveBeenCalledWith("default");
  });

  it("shows signed-in user info when authStore.user is set", async () => {
    const { useAuthStore } = await import("../../stores/auth");
    const authStore = useAuthStore();
    authStore.user = {
      id: "u1",
      username: "alice",
      email: "alice@example.com",
    };

    const wrapper = mount(AccountSettings);
    await nextTick();

    expect(wrapper.text()).toContain("alice");
    expect(wrapper.text()).toContain("Sign out");
  });

  it("shows sign-in prompt when authStore.user is null", async () => {
    const { useAuthStore } = await import("../../stores/auth");
    const authStore = useAuthStore();
    authStore.user = null;

    const wrapper = mount(AccountSettings);
    await nextTick();

    expect(wrapper.text()).toContain("Not connected");
    expect(wrapper.text()).toContain("Sign In");
  });
});
