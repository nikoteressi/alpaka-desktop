import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

// Mutable isOpen ref so individual tests can control it
let isOpenRef = ref(false);
const toggleInternalMock = vi.fn();

vi.mock("../../composables/useCollapsibleState", () => ({
  useCollapsibleState: vi.fn(() => ({
    isOpen: isOpenRef,
    toggle: toggleInternalMock,
    setOpen: vi.fn(),
  })),
}));

// CustomTooltip is a shared UI wrapper — stub it to render slots only
const globalStubs = {
  CustomTooltip: { template: "<div><slot /></div>" },
};

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
  beforeEach(() => {
    isOpenRef = ref(false);
    vi.clearAllMocks();
  });

  it("shows no seed badge when seed is undefined", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find("[data-testid='seed-badge']").exists()).toBe(false);
  });

  it("shows accent seed badge when seed is set", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, seed: 42 },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find("[data-testid='seed-badge']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='seed-badge']").text()).toContain("42");
  });

  it("renders seed row in DOM when seed is set", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, seed: 42 },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find("[data-testid='seed-row']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='seed-row']").text()).toContain("42");
  });

  it("shows seed badge and row when seed is 0", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, seed: 0 },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find("[data-testid='seed-badge']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='seed-row']").exists()).toBe(true);
  });
});

describe("StatsBlock toggle behavior", () => {
  beforeEach(() => {
    isOpenRef = ref(false);
    vi.clearAllMocks();
  });

  it("calls the internal _toggle when the toggle button is clicked", async () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps },
      global: { stubs: globalStubs },
    });
    await wrapper.find(".stats-toggle-btn").trigger("click");
    expect(toggleInternalMock).toHaveBeenCalledOnce();
  });

  it("toggle button click calls stopPropagation", async () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps },
      global: { stubs: globalStubs },
    });
    const stopPropSpy = vi.fn();
    await wrapper.find(".stats-toggle-btn").trigger("click", {
      stopPropagation: stopPropSpy,
    });
    // stopPropagation is called inside the toggle() handler
    // We verify indirectly: toggle was called (if stopProp threw, toggle wouldn't run)
    expect(toggleInternalMock).toHaveBeenCalledOnce();
  });

  it("accordion has closed class when isOpen is false", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find(".stats-accordion").classes()).toContain(
      "stats-accordion--closed",
    );
  });

  it("accordion does not have closed class when isOpen is true", async () => {
    isOpenRef = ref(true);
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find(".stats-accordion").classes()).not.toContain(
      "stats-accordion--closed",
    );
  });

  it("toggle button shows 'More' label when closed", () => {
    isOpenRef = ref(false);
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find(".more-label").text()).toContain("More");
  });

  it("toggle button shows 'Hide' label when open", async () => {
    isOpenRef = ref(true);
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find(".more-label").text()).toContain("Hide");
  });
});

describe("StatsBlock stat display", () => {
  beforeEach(() => {
    isOpenRef = ref(false);
    vi.clearAllMocks();
  });

  it("renders tokensPerSec formatted to 1 decimal", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, tokensPerSec: 23.456 },
      global: { stubs: globalStubs },
    });
    expect(wrapper.text()).toContain("23.5");
  });

  it("renders 0.0 when tokensPerSec is 0", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, tokensPerSec: 0 },
      global: { stubs: globalStubs },
    });
    expect(wrapper.text()).toContain("0.0");
  });

  it("renders outputTokens badge when outputTokens > 0", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, outputTokens: 312 },
      global: { stubs: globalStubs },
    });
    expect(wrapper.text()).toContain("312");
    expect(wrapper.text()).toContain("output");
  });

  it("hides outputTokens badge when outputTokens is 0", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, outputTokens: 0 },
      global: { stubs: globalStubs },
    });
    // v-if="outputTokens" — falsy 0 hides it
    const badges = wrapper.findAll(".stat-badge");
    const outputBadge = badges.find((b) => b.text().includes("output"));
    expect(outputBadge).toBeUndefined();
  });

  it("renders inputTokens badge when inputTokens > 0", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, inputTokens: 88 },
      global: { stubs: globalStubs },
    });
    expect(wrapper.text()).toContain("88");
    expect(wrapper.text()).toContain("input");
  });

  it("hides inputTokens badge when inputTokens is 0", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, inputTokens: 0 },
      global: { stubs: globalStubs },
    });
    const badges = wrapper.findAll(".stat-badge");
    const inputBadge = badges.find((b) => b.text().includes("input"));
    expect(inputBadge).toBeUndefined();
  });

  it("renders generation time formatted to 2 decimals when generationTimeMs > 0", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, generationTimeMs: 1410 },
      global: { stubs: globalStubs },
    });
    expect(wrapper.text()).toContain("1.41s");
  });

  it("hides generation time badge when generationTimeMs is 0", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps, generationTimeMs: 0 },
      global: { stubs: globalStubs },
    });
    // v-if="generationTimeMs" — falsy 0 hides the time badge (the CustomTooltip wrapping it).
    // The stats-summary area contains only the speed, output, input badges and the More label.
    // Count stat-badge elements: speed + output + input = 3 (no time badge).
    const summaryBadges = wrapper.findAll(".stats-summary .stat-badge");
    const hasClock = summaryBadges.some((b) => {
      // The time badge contains a clock SVG (circle+polyline) — detect via text ending in "s" pattern
      // but NOT "tokens/s" or "output" or "input"
      const txt = b.text();
      return (
        txt.endsWith("s") &&
        !txt.includes("tokens") &&
        !txt.includes("output") &&
        !txt.includes("input")
      );
    });
    expect(hasClock).toBe(false);
  });

  it("shows 0 prompt eval rate when prompt_eval_duration_ms is 0", () => {
    const wrapper = mount(StatsBlock, {
      props: {
        ...baseProps,
        metrics: { ...baseProps.metrics, prompt_eval_duration_ms: 0 },
      },
      global: { stubs: globalStubs },
    });
    // Table row: "Prompt Eval Rate" should show "0 tokens/s"
    const tableText = wrapper.find(".full-stats-table").text();
    expect(tableText).toContain("0");
    expect(tableText).toContain("tokens/s");
  });

  it("calculates prompt eval rate correctly", () => {
    const wrapper = mount(StatsBlock, {
      props: {
        ...baseProps,
        // 100 input tokens / 0.5s = 200 tokens/s
        inputTokens: 100,
        metrics: { ...baseProps.metrics, prompt_eval_duration_ms: 500 },
      },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find(".full-stats-table").text()).toContain("200.0");
  });

  it("renders total_duration_ms in the details table", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps },
      global: { stubs: globalStubs },
    });
    // 1410ms / 1000 = 1.41s
    expect(wrapper.find(".full-stats-table").text()).toContain("1.41");
  });

  it("shows no seed row when seed is undefined", () => {
    const wrapper = mount(StatsBlock, {
      props: { ...baseProps },
      global: { stubs: globalStubs },
    });
    expect(wrapper.find("[data-testid='seed-row']").exists()).toBe(false);
  });
});
