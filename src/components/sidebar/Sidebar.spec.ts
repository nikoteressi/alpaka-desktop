import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

// Mock useConversationLifecycle before any import that triggers it.
// createConversation() without a model throws — prevent that from propagating.
const createConversationMock = vi.fn().mockResolvedValue("new-conv-id");

vi.mock("../../composables/useConversationLifecycle", () => ({
  useConversationLifecycle: () => ({
    createConversation: createConversationMock,
  }),
}));

// Tauri invoke is transitively imported by the chat store
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import Sidebar from "./Sidebar.vue";

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    const wrapper = mount(Sidebar, {
      global: {
        stubs: { ConversationList: { template: "<div />" } },
      },
    });
    expect(wrapper.exists()).toBe(true);
  });

  it("renders the New Chat button", () => {
    const wrapper = mount(Sidebar, {
      global: {
        stubs: { ConversationList: { template: "<div />" } },
      },
    });
    expect(wrapper.text()).toContain("New Chat");
  });

  it("renders the search input", () => {
    const wrapper = mount(Sidebar, {
      global: {
        stubs: { ConversationList: { template: "<div />" } },
      },
    });
    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
  });

  it("search input has placeholder 'Search...'", () => {
    const wrapper = mount(Sidebar, {
      global: {
        stubs: { ConversationList: { template: "<div />" } },
      },
    });
    expect(wrapper.find('input[type="text"]').attributes("placeholder")).toBe(
      "Search...",
    );
  });

  it("updates search model when user types", async () => {
    const wrapper = mount(Sidebar, {
      global: {
        stubs: { ConversationList: { template: "<div />" } },
      },
    });
    const input = wrapper.find('input[type="text"]');
    await input.setValue("my query");
    expect((input.element as HTMLInputElement).value).toBe("my query");
  });

  it("calls createConversation when New Chat button is clicked", async () => {
    const wrapper = mount(Sidebar, {
      global: {
        stubs: { ConversationList: { template: "<div />" } },
      },
    });
    await wrapper.find("button").trigger("click");
    await nextTick();
    expect(createConversationMock).toHaveBeenCalledOnce();
  });

  it("renders ConversationList as a child", () => {
    const wrapper = mount(Sidebar, {
      global: {
        stubs: {
          ConversationList: { template: '<div data-testid="conv-list" />' },
        },
      },
    });
    expect(wrapper.find('[data-testid="conv-list"]').exists()).toBe(true);
  });

  it("renders as an aside element", () => {
    const wrapper = mount(Sidebar, {
      global: {
        stubs: { ConversationList: { template: "<div />" } },
      },
    });
    expect(wrapper.element.tagName.toLowerCase()).toBe("aside");
  });
});
