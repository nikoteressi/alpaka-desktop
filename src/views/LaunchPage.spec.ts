import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import LaunchPage from "./LaunchPage.vue";

describe("LaunchPage", () => {
  beforeEach(() => {
    // Stub navigator.clipboard because happy-dom may not implement it
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const wrapper = mount(LaunchPage);
    expect(wrapper.exists()).toBe(true);
  });

  it("renders all 5 tool cards", () => {
    const wrapper = mount(LaunchPage);
    // Each tool has a name paragraph with font-semibold
    const toolNames = wrapper
      .findAll("p.text-\\[14px\\]")
      .map((el) => el.text());
    expect(toolNames).toHaveLength(5);
  });

  it("renders Claude tool card", () => {
    const wrapper = mount(LaunchPage);
    expect(wrapper.text()).toContain("Claude");
  });

  it("renders Codex tool card", () => {
    const wrapper = mount(LaunchPage);
    expect(wrapper.text()).toContain("Codex");
  });

  it("renders all ollama launch commands", () => {
    const wrapper = mount(LaunchPage);
    const expected = [
      "ollama launch claude",
      "ollama launch codex",
      "ollama launch opencode",
      "ollama launch droid",
      "ollama launch pi",
    ];
    for (const cmd of expected) {
      expect(wrapper.text()).toContain(cmd);
    }
  });

  it("shows clipboard icon before copying", () => {
    const wrapper = mount(LaunchPage);
    // All copy buttons render the clipboard icon (rect element inside svg)
    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(5);
  });

  it("calls navigator.clipboard.writeText with the command when copy button clicked", async () => {
    const wrapper = mount(LaunchPage);
    // Click the first copy button
    await wrapper.findAll("button")[0].trigger("click");
    await nextTick();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "ollama launch claude",
    );
  });

  it("shows checkmark svg after copying (copiedCmd state set)", async () => {
    const wrapper = mount(LaunchPage);
    const copyButton = wrapper.findAll("button")[0];

    // Initially no polyline (checkmark) is visible for this command
    // We trigger the copy to set copiedCmd
    await copyButton.trigger("click");
    await nextTick();

    // The checkmark is rendered via v-if="copiedCmd === tool.cmd"
    // After click, copiedCmd = 'ollama launch claude', so the polyline appears in first button area
    const svgPolylines = wrapper.findAll("polyline");
    const checkmarkPolylines = svgPolylines.filter(
      (el) => el.attributes("points") === "20 6 9 17 4 12",
    );
    expect(checkmarkPolylines.length).toBe(1);
  });

  it("resets copiedCmd to null after 2 seconds", async () => {
    const wrapper = mount(LaunchPage);
    await wrapper.findAll("button")[0].trigger("click");
    await nextTick();

    // Check mark visible
    let checkmarks = wrapper
      .findAll("polyline")
      .filter((el) => el.attributes("points") === "20 6 9 17 4 12");
    expect(checkmarks.length).toBe(1);

    // Advance fake timers by 2 seconds
    vi.advanceTimersByTime(2000);
    await nextTick();

    // Checkmark should disappear now
    checkmarks = wrapper
      .findAll("polyline")
      .filter((el) => el.attributes("points") === "20 6 9 17 4 12");
    expect(checkmarks.length).toBe(0);
  });

  it("logs error to console when clipboard.writeText fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
      new Error("permission denied"),
    );

    const wrapper = mount(LaunchPage);
    await wrapper.findAll("button")[0].trigger("click");
    await nextTick();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to copy:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("does not set copiedCmd when clipboard fails", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(
      new Error("denied"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(LaunchPage);
    await wrapper.findAll("button")[0].trigger("click");
    await nextTick();

    // No checkmark should appear
    const checkmarks = wrapper
      .findAll("polyline")
      .filter((el) => el.attributes("points") === "20 6 9 17 4 12");
    expect(checkmarks.length).toBe(0);
  });

  it("each tool shows its first letter as icon initial", () => {
    const wrapper = mount(LaunchPage);
    // The icon span shows tool.name[0]
    const iconSpans = wrapper.findAll(
      ".text-\\[var\\(--text-muted\\)\\].font-bold",
    );
    const initials = iconSpans.map((el) => el.text());
    expect(initials).toContain("C"); // Claude, Codex
    expect(initials).toContain("O"); // OpenCode
    expect(initials).toContain("D"); // Droid
    expect(initials).toContain("P"); // Pi
  });
});
