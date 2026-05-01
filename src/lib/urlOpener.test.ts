import { describe, it, expect, vi, beforeEach } from "vitest";
import { openUrl } from "./urlOpener";

const { mockOpenBrowser } = vi.hoisted(() => ({
  mockOpenBrowser: vi.fn(),
}));

vi.mock("./tauri", () => ({
  tauriApi: {
    openBrowser: mockOpenBrowser,
  },
}));

describe("openUrl", () => {
  beforeEach(() => {
    mockOpenBrowser.mockReset();
  });

  it("does nothing for ftp:// URL", async () => {
    await openUrl("ftp://example.com/file");
    expect(mockOpenBrowser).not.toHaveBeenCalled();
  });

  it("does nothing for steam:// protocol", async () => {
    await openUrl("steam://run/12345");
    expect(mockOpenBrowser).not.toHaveBeenCalled();
  });

  it("does nothing for file:// protocol", async () => {
    await openUrl("file:///etc/passwd");
    expect(mockOpenBrowser).not.toHaveBeenCalled();
  });

  it("does nothing for empty string", async () => {
    await openUrl("");
    expect(mockOpenBrowser).not.toHaveBeenCalled();
  });

  it("calls openBrowser for https:// URL", async () => {
    mockOpenBrowser.mockResolvedValue(undefined);
    await openUrl("https://example.com/page");
    expect(mockOpenBrowser).toHaveBeenCalledWith("https://example.com/page");
  });

  it("calls openBrowser for http:// URL", async () => {
    mockOpenBrowser.mockResolvedValue(undefined);
    await openUrl("http://localhost:11434");
    expect(mockOpenBrowser).toHaveBeenCalledWith("http://localhost:11434");
  });

  it("falls back to window.open when openBrowser throws", async () => {
    mockOpenBrowser.mockRejectedValue(new Error("Tauri unavailable"));
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);

    await openUrl("https://example.com");

    expect(windowOpenSpy).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer",
    );
    windowOpenSpy.mockRestore();
  });
});
