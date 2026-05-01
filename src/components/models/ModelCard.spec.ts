import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

// ModelCard is a pure presentation component with no Tauri/store deps
const CustomTooltipStub = {
  name: "CustomTooltip",
  template: "<div><slot /></div>",
  props: ["text", "wrapperClass"],
};

import ModelCard from "./ModelCard.vue";

const globalOpts = {
  stubs: { CustomTooltip: CustomTooltipStub },
};

describe("ModelCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── sizeTags / capTags computed ─────────────────────────────────────────────

  it("separates size tags from cap tags", () => {
    const wrapper = mount(ModelCard, {
      props: {
        name: "llama3",
        tags: ["8b", "70B", "0.5m", "vision", "tools"],
      },
      global: globalOpts,
    });

    // size tags rendered with tagClass (tag-size)
    const sizeTags = wrapper
      .findAll(".model-tag")
      .filter((el) => el.classes("tag-size"));
    expect(sizeTags).toHaveLength(3); // 8b, 70B, 0.5m

    // cap tags rendered — vision + tools
    const capTags = wrapper
      .findAll(".model-tag")
      .filter((el) => !el.classes("tag-size"));
    expect(capTags).toHaveLength(2);
  });

  it("renders no tags when tags prop is omitted", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "mymodel" },
      global: globalOpts,
    });
    expect(wrapper.findAll(".model-tag")).toHaveLength(0);
  });

  // ── tagClass — all branches ─────────────────────────────────────────────────

  it.each([
    ["vision", "tag-vision"],
    ["Vision", "tag-vision"],
    ["tools", "tag-tools"],
    ["Tools", "tag-tools"],
    ["thinking", "tag-thinking"],
    ["think", "tag-thinking"],
    ["cloud", "tag-cloud"],
    ["embedding", "tag-embedding"],
    ["embed", "tag-embedding"],
    ["audio", "tag-audio"],
    ["8b", "tag-size"],
    ["70B", "tag-size"],
    ["0.5M", "tag-size"],
    ["unknown", "tag-generic"],
    ["custom", "tag-generic"],
  ])("tagClass('%s') → '%s' class on rendered tag", (tag, expectedClass) => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", tags: [tag] },
      global: globalOpts,
    });
    // All rendered .model-tag spans for non-size tags show via capTags or sizeTags
    const tagEls = wrapper.findAll(".model-tag");
    // At least one of them has the expected class
    const hasClass = tagEls.some((el) => el.classes(expectedClass));
    expect(hasClass).toBe(true);
  });

  // ── tagLabel mapping ────────────────────────────────────────────────────────

  it("tagLabel maps 'thinking' → 'think'", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", tags: ["thinking"] },
      global: globalOpts,
    });
    const capTagEls = wrapper
      .findAll(".model-tag")
      .filter((el) => !el.classes("tag-size"));
    expect(capTagEls[0].text()).toBe("think");
  });

  it("tagLabel maps 'embedding' → 'embed'", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", tags: ["embedding"] },
      global: globalOpts,
    });
    const capTagEls = wrapper
      .findAll(".model-tag")
      .filter((el) => !el.classes("tag-size"));
    expect(capTagEls[0].text()).toBe("embed");
  });

  it("tagLabel passes through unknown tags unchanged", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", tags: ["myCustomTag"] },
      global: globalOpts,
    });
    const capTagEls = wrapper
      .findAll(".model-tag")
      .filter((el) => !el.classes("tag-size"));
    expect(capTagEls[0].text()).toBe("myCustomTag");
  });

  // ── model-card--clickable ───────────────────────────────────────────────────

  it("adds model-card--clickable class when onClick is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", onClick: vi.fn() },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card").classes()).toContain(
      "model-card--clickable",
    );
  });

  it("does not add model-card--clickable when onClick is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card").classes()).not.toContain(
      "model-card--clickable",
    );
  });

  // ── onClick invocation ──────────────────────────────────────────────────────

  it("calls onClick when card is clicked", async () => {
    const onClick = vi.fn();
    const wrapper = mount(ModelCard, {
      props: { name: "m", onClick },
      global: globalOpts,
    });
    await wrapper.find(".model-card").trigger("click");
    expect(onClick).toHaveBeenCalledOnce();
  });

  // ── hovered state ───────────────────────────────────────────────────────────

  it("adds model-card--hovered class on mouseenter", async () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    await wrapper.find(".model-card").trigger("mouseenter");
    expect(wrapper.find(".model-card").classes()).toContain(
      "model-card--hovered",
    );
  });

  it("removes model-card--hovered class on mouseleave", async () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    const card = wrapper.find(".model-card");
    await card.trigger("mouseenter");
    expect(card.classes()).toContain("model-card--hovered");
    await card.trigger("mouseleave");
    expect(card.classes()).not.toContain("model-card--hovered");
  });

  // ── isInstalled badge ───────────────────────────────────────────────────────

  it("shows 'Pulled' badge when isInstalled is true", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", isInstalled: true },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__pulled-badge").exists()).toBe(true);
    expect(wrapper.find(".model-card__pulled-badge").text()).toBe("Pulled");
  });

  it("hides 'Pulled' badge when isInstalled is false", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", isInstalled: false },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__pulled-badge").exists()).toBe(false);
  });

  // ── pullCount ───────────────────────────────────────────────────────────────

  it("shows pull count when pullCount is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", pullCount: "1.2M" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__pull-count").exists()).toBe(true);
    expect(wrapper.find(".model-card__pull-count").text()).toContain("1.2M");
  });

  it("hides pull count when pullCount is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__pull-count").exists()).toBe(false);
  });

  // ── description ────────────────────────────────────────────────────────────

  it("renders description paragraph when description is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", description: "A great model" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__desc").exists()).toBe(true);
    expect(wrapper.find(".model-card__desc").text()).toBe("A great model");
  });

  it("hides description paragraph when description is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__desc").exists()).toBe(false);
  });

  // ── quant ───────────────────────────────────────────────────────────────────

  it("shows quant span when quant is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", quant: "Q4_K_M" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__quant").exists()).toBe(true);
    expect(wrapper.find(".model-card__quant").text()).toBe("Q4_K_M");
  });

  it("hides quant span when quant is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__quant").exists()).toBe(false);
  });

  // ── capTags section ─────────────────────────────────────────────────────────

  it("renders cap-tags div when non-size tags are present", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", tags: ["vision", "tools"] },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__cap-tags").exists()).toBe(true);
  });

  it("hides cap-tags div when only size tags are present", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", tags: ["8b", "70b"] },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__cap-tags").exists()).toBe(false);
  });

  // ── userTags section ────────────────────────────────────────────────────────

  it("renders user tags when userTags has items", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", userTags: ["code", "fast"] },
      global: globalOpts,
    });
    const userTagSection = wrapper.find(".model-card__user-tags");
    expect(userTagSection.exists()).toBe(true);
    expect(userTagSection.text()).toContain("code");
    expect(userTagSection.text()).toContain("fast");
  });

  it("hides user tags section when userTags is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__user-tags").exists()).toBe(false);
  });

  it("hides user tags section when userTags is empty array", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", userTags: [] },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__user-tags").exists()).toBe(false);
  });

  it("shows overflow span '+N' when more than 3 user tags", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", userTags: ["a", "b", "c", "d", "e"] },
      global: globalOpts,
    });
    const overflow = wrapper
      .findAll(".model-card__user-tags .model-tag")
      .find((el) => el.text().startsWith("+"));
    expect(overflow).toBeDefined();
    expect(overflow!.text()).toBe("+2");
  });

  it("does not show overflow span when 3 or fewer user tags", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", userTags: ["a", "b", "c"] },
      global: globalOpts,
    });
    const overflow = wrapper
      .findAll(".model-card__user-tags .model-tag")
      .find((el) => el.text().startsWith("+"));
    expect(overflow).toBeUndefined();
  });

  // ── date ────────────────────────────────────────────────────────────────────

  it("renders date when date is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", date: "Jan 1" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__date").exists()).toBe(true);
    expect(wrapper.find(".model-card__date").text()).toContain("Jan 1");
  });

  it("hides date when date is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__date").exists()).toBe(false);
  });

  // ── fileSize ────────────────────────────────────────────────────────────────

  it("renders fileSize when fileSize is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", fileSize: "4.7 GB" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__filesize").exists()).toBe(true);
    expect(wrapper.find(".model-card__filesize").text()).toContain("4.7 GB");
  });

  it("prepends '· ' to fileSize when both date and fileSize are provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", date: "Jan 1", fileSize: "4.7 GB" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__filesize").text()).toContain("· 4.7 GB");
  });

  it("does not prepend '· ' when only fileSize is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", fileSize: "4.7 GB" },
      global: globalOpts,
    });
    const text = wrapper.find(".model-card__filesize").text();
    expect(text).not.toContain("· ");
    expect(text).toContain("4.7 GB");
  });

  it("hides fileSize when fileSize is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__filesize").exists()).toBe(false);
  });

  // ── onFavorite button ───────────────────────────────────────────────────────

  it("renders favorite button when onFavorite is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", onFavorite: vi.fn() },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__favorite").exists()).toBe(true);
  });

  it("hides favorite button when onFavorite is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__favorite").exists()).toBe(false);
  });

  it("calls onFavorite when favorite button is clicked", async () => {
    const onFavorite = vi.fn();
    const wrapper = mount(ModelCard, {
      props: { name: "m", onFavorite },
      global: globalOpts,
    });
    await wrapper.find(".model-card__favorite").trigger("click");
    expect(onFavorite).toHaveBeenCalledOnce();
  });

  it("renders filled star svg when isFavorite is true", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", onFavorite: vi.fn(), isFavorite: true },
      global: globalOpts,
    });
    const svg = wrapper.find(".model-card__favorite svg");
    expect(svg.attributes("fill")).toBe("currentColor");
  });

  it("renders outline star svg when isFavorite is false", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", onFavorite: vi.fn(), isFavorite: false },
      global: globalOpts,
    });
    const svg = wrapper.find(".model-card__favorite svg");
    expect(svg.attributes("fill")).toBe("none");
  });

  // ── onEditTags button ───────────────────────────────────────────────────────

  it("renders tag edit button when onEditTags is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", onEditTags: vi.fn() },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__tags").exists()).toBe(true);
  });

  it("hides tag edit button when onEditTags is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__tags").exists()).toBe(false);
  });

  it("calls onEditTags when tag edit button is clicked", async () => {
    const onEditTags = vi.fn();
    const wrapper = mount(ModelCard, {
      props: { name: "m", onEditTags },
      global: globalOpts,
    });
    await wrapper.find(".model-card__tags").trigger("click");
    expect(onEditTags).toHaveBeenCalledOnce();
  });

  // ── onDelete button ─────────────────────────────────────────────────────────

  it("renders delete button when onDelete is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", onDelete: vi.fn() },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__delete").exists()).toBe(true);
  });

  it("hides delete button when onDelete is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__delete").exists()).toBe(false);
  });

  it("calls onDelete when delete button is clicked", async () => {
    const onDelete = vi.fn();
    const wrapper = mount(ModelCard, {
      props: { name: "m", onDelete },
      global: globalOpts,
    });
    await wrapper.find(".model-card__delete").trigger("click");
    expect(onDelete).toHaveBeenCalledOnce();
  });

  // ── onAction + actionLabel button ───────────────────────────────────────────

  it("renders action button when both onAction and actionLabel are provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", onAction: vi.fn(), actionLabel: "Pull" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__action").exists()).toBe(true);
    expect(wrapper.find(".model-card__action").text()).toContain("Pull");
  });

  it("hides action button when onAction is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", actionLabel: "Pull" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__action").exists()).toBe(false);
  });

  it("hides action button when actionLabel is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", onAction: vi.fn() },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__action").exists()).toBe(false);
  });

  it("calls onAction when action button is clicked", async () => {
    const onAction = vi.fn();
    const wrapper = mount(ModelCard, {
      props: { name: "m", onAction, actionLabel: "Run" },
      global: globalOpts,
    });
    await wrapper.find(".model-card__action").trigger("click");
    expect(onAction).toHaveBeenCalledOnce();
  });

  // ── pullingPct progress bar ─────────────────────────────────────────────────

  it("renders progress bar when pullingPct is provided", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", pullingPct: 42 },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__progress-track").exists()).toBe(true);
    expect(
      wrapper.find(".model-card__progress-fill").attributes("style"),
    ).toContain("width: 42%");
  });

  it("renders progress bar at 0% when pullingPct is 0", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", pullingPct: 0 },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__progress-track").exists()).toBe(true);
    expect(
      wrapper.find(".model-card__progress-fill").attributes("style"),
    ).toContain("width: 0%");
  });

  it("hides progress bar when pullingPct is undefined", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__progress-track").exists()).toBe(false);
  });

  // ── name display ────────────────────────────────────────────────────────────

  it("displays the first character of name (uppercased) as the icon letter", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "llama3" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__icon").text()).toBe("L");
  });

  it("uses '?' when name is empty string", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__icon").text()).toBe("?");
  });

  it("displays model name in the name span", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "mistral" },
      global: globalOpts,
    });
    expect(wrapper.find(".model-card__name").text()).toBe("mistral");
  });

  // ── glowColor ───────────────────────────────────────────────────────────────

  it("applies custom glowColor to glow element", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m", glowColor: "rgba(255,0,0,0.5)" },
      global: globalOpts,
    });
    const glow = wrapper.find(".model-card__glow");
    // Browser normalizes rgba values with spaces — match loosely
    expect(glow.attributes("style")).toMatch(/rgba\(255,\s*0,\s*0,\s*0\.5\)/);
  });

  it("uses default glow color when glowColor is absent", () => {
    const wrapper = mount(ModelCard, {
      props: { name: "m" },
      global: globalOpts,
    });
    const glow = wrapper.find(".model-card__glow");
    // Browser normalizes rgba values with spaces — match loosely
    expect(glow.attributes("style")).toMatch(
      /rgba\(74,\s*128,\s*208,\s*0\.13\)/,
    );
  });
});
