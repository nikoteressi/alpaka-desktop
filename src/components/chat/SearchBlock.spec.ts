import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SearchBlock from "./SearchBlock.vue";
import { useChatStore } from "../../stores/chat";

const twoResults = [
  {
    url: "https://example.com/page",
    title: "Example Page",
    content: "Some content",
  },
  {
    url: "https://github.com/user/repo",
    title: "GitHub Repo",
    content: "Readme",
  },
];

describe("SearchBlock — found type", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows 'Searching web...' label when state is reading", () => {
    const wrapper = mount(SearchBlock, {
      props: {
        type: "found",
        query: "AI news",
        state: "reading",
        isStreaming: true,
      },
    });
    expect(wrapper.text()).toContain("Searching web...");
  });

  it("shows 'Found N web pages' label when results are provided", () => {
    const wrapper = mount(SearchBlock, {
      props: {
        type: "found",
        query: "test",
        results: twoResults,
        state: "done",
      },
    });
    expect(wrapper.text()).toContain("Found 2 web pages");
  });

  it("shows spinner svg when state is reading", () => {
    const wrapper = mount(SearchBlock, {
      props: { type: "found", state: "reading", isStreaming: true },
    });
    expect(wrapper.find(".animate-spin").exists()).toBe(true);
  });

  it("does not show spinner when state is done", () => {
    const wrapper = mount(SearchBlock, {
      props: { type: "found", results: twoResults, state: "done" },
    });
    expect(wrapper.find(".animate-spin").exists()).toBe(false);
  });

  it("renders favicons for unique domains", () => {
    const wrapper = mount(SearchBlock, {
      props: { type: "found", results: twoResults, state: "done" },
    });
    const imgs = wrapper.findAll("img.search-badge__favicon");
    expect(imgs.length).toBe(2);
    expect(imgs[0].attributes("src")).toContain("google.com/s2/favicons");
    expect(imgs[0].attributes("src")).toContain("example.com");
  });

  it("deduplicates favicons for same domain", () => {
    const sameHost = [
      { url: "https://example.com/a", title: "A", content: "" },
      { url: "https://example.com/b", title: "B", content: "" },
    ];
    const wrapper = mount(SearchBlock, {
      props: { type: "found", results: sameHost, state: "done" },
    });
    expect(wrapper.findAll("img.search-badge__favicon").length).toBe(1);
  });
});

describe("SearchBlock — final type", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows count label", () => {
    const wrapper = mount(SearchBlock, {
      props: { type: "final", results: twoResults },
    });
    expect(wrapper.text()).toContain("2 web pages");
  });

  it("shows chevron", () => {
    const wrapper = mount(SearchBlock, {
      props: { type: "final", results: twoResults },
    });
    expect(wrapper.find(".search-badge__chevron").exists()).toBe(true);
  });
});

describe("SearchBlock — sidebar toggle", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("opens sidebar when badge is clicked", async () => {
    const chatStore = useChatStore();
    const wrapper = mount(SearchBlock, {
      props: { type: "final", messageId: "msg-1", results: twoResults },
    });
    await wrapper.find(".search-badge").trigger("click");
    expect(chatStore.streaming.sidebarOpen).toBe(true);
    expect(chatStore.streaming.activeSearchMessageId).toBe("msg-1");
  });

  it("closes sidebar when badge is clicked while active", async () => {
    const chatStore = useChatStore();
    chatStore.openSearchSidebar("msg-1", twoResults);
    const wrapper = mount(SearchBlock, {
      props: { type: "final", messageId: "msg-1", results: twoResults },
    });
    await wrapper.find(".search-badge").trigger("click");
    expect(chatStore.streaming.sidebarOpen).toBe(false);
  });

  it("applies active class when sidebar is open for this message", () => {
    const chatStore = useChatStore();
    chatStore.openSearchSidebar("msg-1", twoResults);
    const wrapper = mount(SearchBlock, {
      props: { type: "final", messageId: "msg-1", results: twoResults },
    });
    expect(wrapper.find(".search-badge--active").exists()).toBe(true);
  });

  it("does not apply active class for a different messageId", () => {
    const chatStore = useChatStore();
    chatStore.openSearchSidebar("msg-OTHER", twoResults);
    const wrapper = mount(SearchBlock, {
      props: { type: "final", messageId: "msg-1", results: twoResults },
    });
    expect(wrapper.find(".search-badge--active").exists()).toBe(false);
  });
});

describe("SearchBlock — favicon error handling", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("handleFaviconError hides the parent element of a broken favicon", async () => {
    const wrapper = mount(SearchBlock, {
      props: { type: "final", results: twoResults },
    });
    const img = wrapper.find("img.search-badge__favicon");
    expect(img.exists()).toBe(true);

    const parent = img.element.parentElement as HTMLElement;
    parent.style.display = "flex";

    await img.trigger("error");

    expect(parent.style.display).toBe("none");
  });

  it("favicon URL computation skips results with invalid URLs", () => {
    const badResult = [
      { url: "not-a-valid-url", title: "Bad", content: "" },
      { url: "https://valid.com/page", title: "Good", content: "" },
    ];
    const wrapper = mount(SearchBlock, {
      props: { type: "final", results: badResult },
    });
    const imgs = wrapper.findAll("img.search-badge__favicon");
    // Only the valid URL produces a favicon
    expect(imgs.length).toBe(1);
    expect(imgs[0].attributes("src")).toContain("valid.com");
  });
});
