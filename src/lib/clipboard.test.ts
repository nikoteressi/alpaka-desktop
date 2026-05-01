import { describe, it, expect, vi, beforeEach } from "vitest";

describe("copyToClipboard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns true and calls navigator.clipboard.writeText in secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText } },
      configurable: true,
    });
    Object.defineProperty(globalThis, "isSecureContext", {
      value: true,
      configurable: true,
    });

    const { copyToClipboard } = await import("./clipboard");
    const result = await copyToClipboard("hello");

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result).toBe(true);
  });

  it("returns false when not in a secure context", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: vi.fn() } },
      configurable: true,
    });
    Object.defineProperty(globalThis, "isSecureContext", {
      value: false,
      configurable: true,
    });

    const { copyToClipboard } = await import("./clipboard");
    const result = await copyToClipboard("hello");

    expect(result).toBe(false);
  });

  it("returns false when navigator.clipboard is unavailable", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    });
    Object.defineProperty(globalThis, "isSecureContext", {
      value: true,
      configurable: true,
    });

    const { copyToClipboard } = await import("./clipboard");
    const result = await copyToClipboard("hello");

    expect(result).toBe(false);
  });

  it("returns false and logs error when writeText rejects", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText } },
      configurable: true,
    });
    Object.defineProperty(globalThis, "isSecureContext", {
      value: true,
      configurable: true,
    });

    const { copyToClipboard } = await import("./clipboard");
    const result = await copyToClipboard("hello");

    expect(result).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
