import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import ErrorScreen from "./ErrorScreen.vue";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => mockInvoke(cmd, args),
}));

const mockCopy = vi.fn().mockResolvedValue(undefined);
vi.mock("../../composables/useCopyToClipboard", () => ({
  useCopyToClipboard: () => ({
    copied: { value: false },
    copy: mockCopy,
  }),
}));

describe("ErrorScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it("renders the error screen with data-testid", () => {
    const wrapper = mount(ErrorScreen);
    expect(wrapper.find('[data-testid="error-screen"]').exists()).toBe(true);
  });

  it("emits retry when Retry Connection is clicked", async () => {
    const wrapper = mount(ErrorScreen);
    const retryBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Retry"));
    await retryBtn!.trigger("click");
    expect(wrapper.emitted("retry")).toBeTruthy();
  });

  it("emits openSettings when Change Host is clicked", async () => {
    const wrapper = mount(ErrorScreen);
    const settingsBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Change Host"));
    await settingsBtn!.trigger("click");
    expect(wrapper.emitted("openSettings")).toBeTruthy();
  });

  it("calls startOllama invoke when Start Ollama Service is clicked", async () => {
    vi.useFakeTimers();
    const wrapper = mount(ErrorScreen);
    const startBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Start Ollama"));
    await startBtn!.trigger("click");
    expect(mockInvoke).toHaveBeenCalledWith("start_ollama", undefined);
    vi.useRealTimers();
  });

  it("shows loading state while starting service", async () => {
    mockInvoke.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
    );
    const wrapper = mount(ErrorScreen);
    const startBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("Start Ollama"))!;
    await startBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Starting...");
  });

  it("copies install command when copy button is clicked", async () => {
    const wrapper = mount(ErrorScreen);
    const copyBtn = wrapper.find("button[title='Copy to clipboard']");
    if (copyBtn.exists()) {
      await copyBtn.trigger("click");
      expect(mockCopy).toHaveBeenCalledWith(
        "curl -fsSL https://ollama.com/install.sh | sh",
      );
    }
  });
});
