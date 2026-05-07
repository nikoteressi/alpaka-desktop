import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SearchSidebar from "./SearchSidebar.vue";
import { useChatStore } from "../../stores/chat";

const results = [
  { url: "https://example.com/page", title: "Example", content: "Content" },
  { url: "not-valid-url", title: "Bad", content: "" },
];

describe("SearchSidebar", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders results when sidebar is open", () => {
    const chatStore = useChatStore();
    chatStore.openSearchSidebar("msg-1", results);

    const wrapper = mount(SearchSidebar);
    expect(wrapper.text()).toContain("Example");
    expect(wrapper.text()).toContain("Search results");
  });

  it("shows hostname derived from URL via getHostname", () => {
    const chatStore = useChatStore();
    chatStore.openSearchSidebar("msg-1", results);

    const wrapper = mount(SearchSidebar);
    expect(wrapper.text()).toContain("example.com");
  });

  it("getFavicon returns google favicon URL for valid URL", () => {
    const chatStore = useChatStore();
    chatStore.openSearchSidebar("msg-1", [results[0]]);

    const wrapper = mount(SearchSidebar);
    const img = wrapper.find("img.source-card__favicon");
    expect(img.attributes("src")).toContain("google.com/s2/favicons");
    expect(img.attributes("src")).toContain("example.com");
  });

  it("handleFaviconError hides the broken favicon image", async () => {
    const chatStore = useChatStore();
    chatStore.openSearchSidebar("msg-1", [results[0]]);

    const wrapper = mount(SearchSidebar);
    const img = wrapper.find("img.source-card__favicon");
    expect(img.exists()).toBe(true);

    await img.trigger("error");

    expect((img.element as HTMLImageElement).style.display).toBe("none");
  });

  it("close button calls closeSearchSidebar", async () => {
    const chatStore = useChatStore();
    chatStore.openSearchSidebar("msg-1", results);

    const wrapper = mount(SearchSidebar);
    await wrapper.find(".search-sidebar__close").trigger("click");
    expect(chatStore.streaming.sidebarOpen).toBe(false);
  });
});
