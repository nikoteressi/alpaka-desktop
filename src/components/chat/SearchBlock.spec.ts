import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";

vi.mock("../../composables/useCollapsibleState", () => ({
  useCollapsibleState: vi.fn(() => ({
    isOpen: { value: false },
    toggle: vi.fn(),
    setOpen: vi.fn(),
  })),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const { default: SearchBlock } = await import("./SearchBlock.vue");

describe("SearchBlock", () => {
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

  it("shows 'Sourced' label when result is provided", () => {
    const result = JSON.stringify([
      { url: "https://example.com", title: "Ex", snippet: "desc" },
    ]);
    const wrapper = mount(SearchBlock, {
      props: { query: "test", result },
    });
    expect(wrapper.text()).toContain("Sourced");
  });
});
