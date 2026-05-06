import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

import { useChatStore, uint8ArrayToBase64 } from "./chat";

describe("uint8ArrayToBase64", () => {
  it("encodes a Uint8Array to a base64 string", () => {
    const bytes = new TextEncoder().encode("hello");
    const result = uint8ArrayToBase64(bytes);
    expect(result).toBe(btoa("hello"));
  });
});

describe("chat store — toggleStats", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("adds a messageId to expandedStats when not present", () => {
    const store = useChatStore();
    store.toggleStats("msg-1");
    expect(store.expandedStats.has("msg-1")).toBe(true);
  });

  it("removes a messageId from expandedStats when already present", () => {
    const store = useChatStore();
    store.toggleStats("msg-1");
    store.toggleStats("msg-1");
    expect(store.expandedStats.has("msg-1")).toBe(false);
  });
});
