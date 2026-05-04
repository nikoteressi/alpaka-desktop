import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}));

const { default: ProxySettings } = await import("./ProxySettings.vue");

function mountComponent() {
  return mount(ProxySettings, {
    global: { plugins: [createPinia()] },
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  mockInvoke.mockReset();
});

describe("ProxySettings", () => {
  it("calls get_proxy_config on mount and shows empty fields", async () => {
    mockInvoke.mockResolvedValue({
      proxy_url: "",
      username: "",
      has_password: false,
    });
    const wrapper = mountComponent();
    await flushPromises();

    expect(mockInvoke).toHaveBeenCalledWith("get_proxy_config", undefined);
    const inputs = wrapper.findAll("input");
    expect(inputs[0].element.value).toBe(""); // proxyUrl
    expect(inputs[1].element.value).toBe(""); // username
  });

  it("populates proxy URL and username from get_proxy_config", async () => {
    mockInvoke.mockResolvedValue({
      proxy_url: "http://proxy.corp.com:3128",
      username: "alice",
      has_password: true,
    });
    const wrapper = mountComponent();
    await flushPromises();

    const inputs = wrapper.findAll("input");
    expect(inputs[0].element.value).toBe("http://proxy.corp.com:3128");
    expect(inputs[1].element.value).toBe("alice");
  });

  it("shows password placeholder '••••••••' when has_password is true", async () => {
    mockInvoke.mockResolvedValue({
      proxy_url: "http://p:3128",
      username: "",
      has_password: true,
    });
    const wrapper = mountComponent();
    await flushPromises();

    const passwordInput = wrapper.find("input[type='password']");
    expect(passwordInput.attributes("placeholder")).toBe("••••••••");
  });

  it("calls save_proxy with form values on Save click", async () => {
    mockInvoke.mockResolvedValueOnce({
      proxy_url: "",
      username: "",
      has_password: false,
    });
    const wrapper = mountComponent();
    await flushPromises();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);

    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("socks5://proxy:1080");
    await inputs[1].setValue("bob");
    await inputs[2].setValue("secret");

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Save"));
    await saveBtn!.trigger("click");
    await flushPromises();

    expect(mockInvoke).toHaveBeenCalledWith("save_proxy", {
      proxyUrl: "socks5://proxy:1080",
      username: "bob",
      password: "secret",
    });
  });

  it("calls test_proxy and shows success message", async () => {
    mockInvoke.mockResolvedValueOnce({
      proxy_url: "http://p:3128",
      username: "",
      has_password: false,
    });
    const wrapper = mountComponent();
    await flushPromises();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({
      success: true,
      message: "Proxy is reachable",
    });

    const testBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Test"));
    await testBtn!.trigger("click");
    await flushPromises();

    expect(mockInvoke).toHaveBeenCalledWith(
      "test_proxy",
      expect.objectContaining({
        proxyUrl: "http://p:3128",
      }),
    );
    expect(wrapper.text()).toContain("Proxy is reachable");
  });

  it("shows error message when test_proxy returns success: false", async () => {
    mockInvoke.mockResolvedValueOnce({
      proxy_url: "http://bad:9999",
      username: "",
      has_password: false,
    });
    const wrapper = mountComponent();
    await flushPromises();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue({
      success: false,
      message: "Connection refused",
    });

    const testBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Test"));
    await testBtn!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Connection refused");
  });

  it("calls delete_proxy and clears fields on Clear click", async () => {
    mockInvoke.mockResolvedValueOnce({
      proxy_url: "http://p:3128",
      username: "u",
      has_password: true,
    });
    const wrapper = mountComponent();
    await flushPromises();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);

    const clearBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Clear"));
    expect(clearBtn?.exists()).toBe(true);
    await clearBtn!.trigger("click");
    await flushPromises();

    expect(mockInvoke).toHaveBeenCalledWith("delete_proxy", undefined);
  });

  it("disables Test button when proxy URL is empty", async () => {
    mockInvoke.mockResolvedValue({
      proxy_url: "",
      username: "",
      has_password: false,
    });
    const wrapper = mountComponent();
    await flushPromises();

    const testBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Test"));
    expect(testBtn!.attributes("disabled")).toBeDefined();
  });

  it("clears password field and updates hasPassword after successful save with password", async () => {
    mockInvoke.mockResolvedValueOnce({
      proxy_url: "http://proxy:3128",
      username: "",
      has_password: false,
    });
    const wrapper = mountComponent();
    await flushPromises();
    mockInvoke.mockReset();
    mockInvoke.mockResolvedValue(undefined);

    const inputs = wrapper.findAll("input");
    await inputs[2].setValue("secret");

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Save"));
    await saveBtn!.trigger("click");
    await flushPromises();

    // Password field should be cleared after save
    expect(inputs[2].element.value).toBe("");
    // Placeholder should switch to the masked indicator
    expect(inputs[2].attributes("placeholder")).toBe("••••••••");
  });

  it("shows Clear button when has_password is true even if URL is empty", async () => {
    mockInvoke.mockResolvedValue({
      proxy_url: "",
      username: "",
      has_password: true,
    });
    const wrapper = mountComponent();
    await flushPromises();

    const clearBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Clear"));
    expect(clearBtn?.exists()).toBe(true);
  });
});
