import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";

vi.mock("../lib/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

import { copyToClipboard } from "../lib/clipboard";

const mockCopy = vi.mocked(copyToClipboard);

function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const Wrapper = defineComponent({
    setup() {
      result = composable();
      return () => h("div");
    },
  });
  const wrapper = mount(Wrapper, { attachTo: document.body });
  return { result, unmount: () => wrapper.unmount() };
}

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copied is false initially", async () => {
    const { useCopyToClipboard } = await import("./useCopyToClipboard");
    const { result } = withSetup(() => useCopyToClipboard());
    expect(result.copied.value).toBe(false);
  });

  it("sets copied to true and resets after duration on successful copy", async () => {
    const { useCopyToClipboard } = await import("./useCopyToClipboard");
    mockCopy.mockResolvedValue(true);
    const { result } = withSetup(() => useCopyToClipboard(500));

    await result.copy("hello");
    expect(result.copied.value).toBe(true);

    vi.advanceTimersByTime(500);
    expect(result.copied.value).toBe(false);
  });

  it("does not set copied when copy fails", async () => {
    const { useCopyToClipboard } = await import("./useCopyToClipboard");
    mockCopy.mockResolvedValue(false);
    const { result } = withSetup(() => useCopyToClipboard());

    await result.copy("hello");
    expect(result.copied.value).toBe(false);
  });

  it("resets previous timer when copy is called again before duration elapses", async () => {
    const { useCopyToClipboard } = await import("./useCopyToClipboard");
    mockCopy.mockResolvedValue(true);
    const { result } = withSetup(() => useCopyToClipboard(1000));

    await result.copy("first");
    vi.advanceTimersByTime(500);
    await result.copy("second");
    vi.advanceTimersByTime(600);
    expect(result.copied.value).toBe(true);
    vi.advanceTimersByTime(400);
    expect(result.copied.value).toBe(false);
  });

  it("clears the timer on unmount", async () => {
    const { useCopyToClipboard } = await import("./useCopyToClipboard");
    mockCopy.mockResolvedValue(true);
    const { result, unmount } = withSetup(() => useCopyToClipboard(1000));

    await result.copy("text");
    unmount();
    vi.advanceTimersByTime(1000);
    expect(result.copied.value).toBe(true);
  });
});
