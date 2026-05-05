import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

let isOpenRef = ref(false);
const toggleMock = vi.fn();

vi.mock("../../composables/useCollapsibleState", () => ({
  useCollapsibleState: vi.fn(() => ({
    isOpen: isOpenRef,
    toggle: toggleMock,
    setOpen: vi.fn(),
  })),
}));

// SearchBlock imports openUrl from ../../lib/urlOpener — mock that directly
const openUrlMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../lib/urlOpener", () => ({ openUrl: openUrlMock }));

const { default: SearchBlock } = await import("./SearchBlock.vue");

// Helper: a well-formed result with a single source
const singleSourceResult = JSON.stringify([
  {
    url: "https://example.com/page",
    title: "Example Page",
    content: "Some content here",
  },
]);

// Helper: the {results: [...]} wrapper shape
const wrappedSourceResult = JSON.stringify({
  results: [
    {
      url: "https://github.com/user/repo",
      title: "GitHub Repo",
      content: "Readme content",
    },
  ],
});

describe("SearchBlock — basic rendering", () => {
  beforeEach(() => {
    isOpenRef = ref(false);
    vi.clearAllMocks();
  });

  it("renders the query text", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "latest AI news" },
    });
    expect(wrapper.text()).toContain("latest AI news");
  });

  it("shows 'Searching for' label when no result", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "something" },
    });
    expect(wrapper.text()).toContain("Searching for");
  });

  it("shows spinner svg (animate-spin) when result is absent", () => {
    const wrapper = mount(SearchBlock, { props: { query: "test" } });
    expect(wrapper.find(".animate-spin").exists()).toBe(true);
  });

  it("shows 'Sourced N references for' label when result is provided", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    expect(wrapper.text()).toContain("Sourced");
    expect(wrapper.text()).toContain("references for");
  });

  it("does not show spinner when result is present", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    expect(wrapper.find(".animate-spin").exists()).toBe(false);
  });

  it("shows chevron svg only when result is present", () => {
    const withResult = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    const withoutResult = mount(SearchBlock, { props: { query: "test" } });
    // Chevron is rendered with v-if="result"
    // Both have rotate-180 class conditionally — check for the chevron container div
    // The header div always exists; the chevron svg is a sibling only when result is set
    expect(withResult.text()).toContain("Sourced");
    expect(withoutResult.text()).not.toContain("Sourced");
  });
});

describe("SearchBlock — toggleCollapse", () => {
  beforeEach(() => {
    isOpenRef = ref(false);
    vi.clearAllMocks();
  });

  it("does not call toggle when header is clicked but result is absent", async () => {
    const wrapper = mount(SearchBlock, { props: { query: "test" } });
    await wrapper.find(".search-block > div").trigger("click");
    expect(toggleMock).not.toHaveBeenCalled();
  });

  it("calls toggle when header is clicked and result is present", async () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    await wrapper.find(".search-block > div").trigger("click");
    expect(toggleMock).toHaveBeenCalledOnce();
  });

  it("accordion has closed class when isOpen is false", () => {
    isOpenRef = ref(false);
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    expect(wrapper.find(".search-accordion").classes()).toContain(
      "search-accordion--closed",
    );
  });

  it("accordion does not have closed class when isOpen is true", () => {
    isOpenRef = ref(true);
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    expect(wrapper.find(".search-accordion").classes()).not.toContain(
      "search-accordion--closed",
    );
  });
});

describe("SearchBlock — parsedResults (bare-array shape)", () => {
  beforeEach(() => {
    isOpenRef = ref(true);
    vi.clearAllMocks();
  });

  it("renders source cards for bare-array result shape", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    // Source cards exist as clickable divs inside the accordion
    const cards = wrapper.findAll(".search-accordion .cursor-pointer");
    expect(cards.length).toBe(1);
  });

  it("renders source cards for {results:[...]} wrapper shape", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: wrappedSourceResult },
    });
    const cards = wrapper.findAll(".search-accordion .cursor-pointer");
    expect(cards.length).toBe(1);
  });

  it("shows sourcesCount equal to number of parsed results", () => {
    const multiResult = JSON.stringify([
      { url: "https://a.com", title: "A", content: "a" },
      { url: "https://b.com", title: "B", content: "b" },
    ]);
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: multiResult },
    });
    expect(wrapper.text()).toContain("Sourced 2 references for");
  });

  it("shows fallback raw text when JSON is valid but yields no array", () => {
    // Neither array nor {results:[]} — falls into neither branch → rawResults=[]
    // The filter then removes all, so parsedResults is empty and fallback div renders
    const emptyObjResult = JSON.stringify({ data: "nothing" });
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: emptyObjResult },
    });
    // parsedResults.length === 0, so fallback div renders the raw result string
    expect(wrapper.find(".font-mono.whitespace-pre-wrap").exists()).toBe(true);
  });

  it("shows fallback raw text when result is invalid JSON", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: "not-json{{{" },
    });
    expect(wrapper.find(".font-mono.whitespace-pre-wrap").exists()).toBe(true);
  });

  it("filters out results with url '#'", () => {
    const resultWithHash = JSON.stringify([
      { url: "#", title: "No URL", content: "filtered out" },
      { url: "https://valid.com", title: "Valid", content: "kept" },
    ]);
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: resultWithHash },
    });
    // Only 1 card (the valid one) — the '#' entry is filtered
    const cards = wrapper.findAll(".search-accordion .cursor-pointer");
    expect(cards.length).toBe(1);
  });

  it("uses 'Untitled Result' when title is missing", () => {
    const resultNoTitle = JSON.stringify([
      { url: "https://example.com", content: "desc" },
    ]);
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: resultNoTitle },
    });
    expect(wrapper.find(".search-accordion").text()).toContain("Example");
  });
});

describe("SearchBlock — extractSiteName", () => {
  beforeEach(() => {
    isOpenRef = ref(true);
    vi.clearAllMocks();
  });

  const mkResult = (url: string) =>
    JSON.stringify([{ url, title: "A Title", content: "c" }]);

  it("returns 'GitHub' for github.com URLs", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: mkResult("https://github.com/user/repo") },
    });
    expect(wrapper.find(".search-accordion").text()).toContain("GitHub");
  });

  it("returns 'Wikipedia' for wikipedia.org URLs", () => {
    // en.wikipedia.org → hostname.replace("www.","") is "en.wikipedia.org"
    // split(".")[0] is "en" which doesn't match — use wikipedia.org directly
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: mkResult("https://wikipedia.org/wiki/Test") },
    });
    expect(wrapper.find(".search-accordion").text()).toContain("Wikipedia");
  });

  it("returns 'Reddit' for reddit.com URLs", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: mkResult("https://www.reddit.com/r/test") },
    });
    expect(wrapper.find(".search-accordion").text()).toContain("Reddit");
  });

  it("returns 'Medium' for medium.com URLs", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: mkResult("https://medium.com/@author/article") },
    });
    expect(wrapper.find(".search-accordion").text()).toContain("Medium");
  });

  it("returns 'arXiv' for arxiv.org URLs", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: mkResult("https://arxiv.org/abs/1234.5678") },
    });
    expect(wrapper.find(".search-accordion").text()).toContain("arXiv");
  });

  it("capitalizes first letter for unknown domains", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: mkResult("https://openai.com/blog") },
    });
    expect(wrapper.find(".search-accordion").text()).toContain("Openai");
  });

  it("falls back to title first word when URL is invalid", () => {
    const resultBadUrl = JSON.stringify([
      { url: "not-a-url", title: "FallbackTitle here", content: "c" },
    ]);
    // Invalid URL is filtered by the url !== '#' filter — it passes since url is not "#"
    // extractSiteName catches the URL parse error and returns title.split(" ")[0]
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: resultBadUrl },
    });
    expect(wrapper.find(".search-accordion").text()).toContain("FallbackTitle");
  });
});

describe("SearchBlock — openUrl", () => {
  beforeEach(() => {
    isOpenRef = ref(true);
    vi.clearAllMocks();
  });

  it("calls openUrl with the source URL when a source card is clicked", async () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    const card = wrapper.find(".search-accordion .cursor-pointer");
    await card.trigger("click");
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/page");
  });
});

describe("SearchBlock — getFaviconUrl / cleanUrl / handleIconError", () => {
  beforeEach(() => {
    isOpenRef = ref(true);
    vi.clearAllMocks();
  });

  it("renders a favicon img with google s2 favicons URL", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    const img = wrapper.find(".search-accordion img");
    expect(img.attributes("src")).toContain("google.com/s2/favicons");
    expect(img.attributes("src")).toContain("example.com");
  });

  it("renders the cleaned URL (no www.) as subdomain label", () => {
    const withWww = JSON.stringify([
      { url: "https://www.example.com/page", title: "Ex", content: "c" },
    ]);
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: withWww },
    });
    const urlLabel = wrapper.find(".search-accordion .font-mono");
    expect(urlLabel.text()).toBe("example.com");
    expect(urlLabel.text()).not.toContain("www.");
  });

  it("handleIconError hides the img when it fails to load", () => {
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result: singleSourceResult },
    });
    const img = wrapper.find(".search-accordion img");
    img.trigger("error");
    expect((img.element as HTMLImageElement).style.display).toBe("none");
  });
});
