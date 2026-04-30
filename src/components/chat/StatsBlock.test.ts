import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("../../composables/useCollapsibleState", () => ({
  useCollapsibleState: vi.fn(() => ({
    isOpen: { value: false },
    toggle: vi.fn(),
    setOpen: vi.fn(),
  })),
}));

const { default: StatsBlock } = await import("./StatsBlock.vue");

const baseProps = {
  metrics: {
    total_duration_ms: 1410,
    load_duration_ms: 10,
    prompt_eval_duration_ms: 200,
    eval_duration_ms: 1200,
  },
  tokensPerSec: 23.4,
  outputTokens: 312,
  inputTokens: 88,
  generationTimeMs: 1410,
};

describe("StatsBlock seed badge", () => {
  it("shows no seed badge when seed is undefined", () => {
    const wrapper = mount(StatsBlock, { props: { ...baseProps } });
    expect(wrapper.find("[data-testid='seed-badge']").exists()).toBe(false);
  });

  it("shows accent seed badge when seed is set", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, seed: 42 },
    });
    expect(wrapper.find("[data-testid='seed-badge']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='seed-badge']").text()).toContain("42");
  });

  it("renders seed row in DOM when seed is set", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, seed: 42 },
    });
    expect(wrapper.find("[data-testid='seed-row']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='seed-row']").text()).toContain("42");
  });

  it("shows seed badge and row when seed is 0", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, seed: 0 },
    });
    expect(wrapper.find("[data-testid='seed-badge']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='seed-row']").exists()).toBe(true);
  });
});
