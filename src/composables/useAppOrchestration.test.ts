import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAppOrchestration } from "./useAppOrchestration";
import type { Conversation } from "../types/chat";
import type { Model } from "../types/models";

// Mock the stores with stable instances
const mockHostStore = {
  activeHostId: "h1",
  setActiveHost: vi.fn(),
};
const mockModelStore = {
  models: [{ name: "m1" }],
  fetchModels: vi.fn(),
};
const mockChatStore = {
  conversations: [] as Partial<Conversation>[],
};

const mockDraftStartNewChat = vi.fn();

vi.mock("../stores/hosts", () => ({
  useHostStore: () => mockHostStore,
}));

vi.mock("../stores/models", () => ({
  useModelStore: () => mockModelStore,
}));

vi.mock("../stores/chat", () => ({
  useChatStore: () => mockChatStore,
}));

vi.mock("./useDraftManager", () => ({
  useDraftManager: () => ({
    startNewChat: mockDraftStartNewChat,
  }),
}));

describe("useAppOrchestration", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockHostStore.activeHostId = "h1";
    mockModelStore.models = [{ name: "m1" }] as Partial<Model>[] as Model[];
    mockChatStore.conversations = [];
  });

  it("switchHost updates host and refreshes models", async () => {
    const { switchHost } = useAppOrchestration();

    await switchHost("h2");

    expect(mockHostStore.setActiveHost).toHaveBeenCalledWith("h2");
    expect(mockModelStore.fetchModels).toHaveBeenCalled();
  });

  it("switchHost does nothing if host is already active", async () => {
    const { switchHost } = useAppOrchestration();

    await switchHost("h1");

    expect(mockHostStore.setActiveHost).not.toHaveBeenCalled();
    expect(mockModelStore.fetchModels).not.toHaveBeenCalled();
  });

  it("startNewChat uses last used model if available", () => {
    mockChatStore.conversations = [
      {
        id: "c1",
        model: "llama3:latest",
      } as Partial<Conversation> as Conversation,
    ];
    const { startNewChat } = useAppOrchestration();

    startNewChat();

    expect(mockDraftStartNewChat).toHaveBeenCalledWith("llama3:latest");
  });

  it("startNewChat fallbacks to first model if no conversations exist", () => {
    const { startNewChat } = useAppOrchestration();

    startNewChat();

    expect(mockDraftStartNewChat).toHaveBeenCalledWith("m1");
  });
});
