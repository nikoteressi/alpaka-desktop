// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

const mockInvoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke: mockInvoke }));

import CompactSummaryBubble from "./CompactSummaryBubble.vue";
import { useChatStore } from "../../stores/chat";
import type { Message } from "../../types/chat";

const CONV = "conv-1";
const summary: Message = {
  id: "s1",
  role: "compact_summary",
  content: "**Summary** of the chat",
};

function mountBubble() {
  return mount(CompactSummaryBubble, {
    props: { message: summary, conversationId: CONV },
  });
}

describe("CompactSummaryBubble", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockReset();
  });

  it("renders the summary as markdown", () => {
    const wrapper = mountBubble();
    expect(wrapper.text()).toContain("Conversation summary");
    expect(wrapper.html()).toContain("<strong>Summary</strong>");
  });

  it("starts collapsed and hides archived history", () => {
    const store = useChatStore();
    store.archivedMessages[CONV] = [
      { id: "a1", role: "user", content: "old question" },
    ];
    const wrapper = mountBubble();
    expect(wrapper.text()).toContain("▾ Show history");
    expect(wrapper.text()).not.toContain("old question");
  });

  it("shows archived messages when history is expanded", async () => {
    const store = useChatStore();
    store.archivedMessages[CONV] = [
      { id: "a1", role: "user", content: "old question" },
      { id: "a2", role: "assistant", content: "old answer" },
      { id: "a3", role: "compact_summary", content: "older summary" },
    ];
    store.showingHistory.add(CONV);
    const wrapper = mountBubble();
    await flushPromises();
    expect(wrapper.text()).toContain("▴ Hide history");
    expect(wrapper.text()).toContain("old question");
    expect(wrapper.text()).toContain("old answer");
    expect(wrapper.text()).toContain("Previous summary");
    const rows = wrapper.findAll(".border-l-2");
    expect(rows[0].classes()).toContain("text-right");
    expect(rows[1].classes()).toContain("text-left");
  });

  it("loads archived messages on first expand and toggles back", async () => {
    mockInvoke.mockResolvedValue([]);
    const store = useChatStore();
    const wrapper = mountBubble();

    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(store.showingHistory.has(CONV)).toBe(true);
    expect(mockInvoke).toHaveBeenCalled();

    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(store.showingHistory.has(CONV)).toBe(false);
  });
});
