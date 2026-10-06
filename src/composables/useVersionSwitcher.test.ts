import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { useChatStore } from "../stores/chat";
import { useVersionSwitcher } from "./useVersionSwitcher";
import type { Message } from "../types/chat";

function makeMsg(
  siblingOrder: number,
  siblingCount: number,
  id = "msg-1",
): Message {
  return {
    role: "assistant",
    content: "hi",
    id,
    siblingOrder,
    siblingCount,
  };
}

describe("useVersionSwitcher", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("hasPrev is false when siblingOrder is 0", () => {
    const { hasPrev } = useVersionSwitcher(() => makeMsg(0, 3));
    expect(hasPrev.value).toBe(false);
  });

  it("hasPrev is true when siblingOrder > 0", () => {
    const { hasPrev } = useVersionSwitcher(() => makeMsg(1, 3));
    expect(hasPrev.value).toBe(true);
  });

  it("hasNext is true when not at last sibling", () => {
    const { hasNext } = useVersionSwitcher(() => makeMsg(0, 3));
    expect(hasNext.value).toBe(true);
  });

  it("hasNext is false when at last sibling", () => {
    const { hasNext } = useVersionSwitcher(() => makeMsg(2, 3));
    expect(hasNext.value).toBe(false);
  });

  it("versionLabel is null when only one sibling", () => {
    const { versionLabel } = useVersionSwitcher(() => makeMsg(0, 1));
    expect(versionLabel.value).toBeNull();
  });

  it("versionLabel shows 1-based position when multiple siblings", () => {
    const { versionLabel } = useVersionSwitcher(() => makeMsg(1, 3));
    expect(versionLabel.value).toBe("2 / 3");
  });

  it("prevVersion calls navigateVersion(-1) when hasPrev is true", async () => {
    const store = useChatStore();
    const navSpy = vi.spyOn(store, "navigateVersion").mockResolvedValue();
    const { prevVersion } = useVersionSwitcher(() => makeMsg(1, 3));
    await prevVersion();
    expect(navSpy).toHaveBeenCalledWith("msg-1", -1);
  });

  it("prevVersion does nothing when hasPrev is false", async () => {
    const store = useChatStore();
    const navSpy = vi.spyOn(store, "navigateVersion").mockResolvedValue();
    const { prevVersion } = useVersionSwitcher(() => makeMsg(0, 3));
    await prevVersion();
    expect(navSpy).not.toHaveBeenCalled();
  });

  it("nextVersion calls navigateVersion(1) when hasNext is true", async () => {
    const store = useChatStore();
    const navSpy = vi.spyOn(store, "navigateVersion").mockResolvedValue();
    const { nextVersion } = useVersionSwitcher(() => makeMsg(0, 3));
    await nextVersion();
    expect(navSpy).toHaveBeenCalledWith("msg-1", 1);
  });

  it("nextVersion does nothing when hasNext is false", async () => {
    const store = useChatStore();
    const navSpy = vi.spyOn(store, "navigateVersion").mockResolvedValue();
    const { nextVersion } = useVersionSwitcher(() => makeMsg(2, 3));
    await nextVersion();
    expect(navSpy).not.toHaveBeenCalled();
  });
});
