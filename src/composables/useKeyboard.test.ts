import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const mockRouterPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useRoute: () => ({ path: "/chat" }),
}));

vi.mock("../lib/appEvents", () => ({
  appEvents: { dispatchEvent: vi.fn() },
  APP_EVENT: {
    FOCUS_SEARCH: "focus-search",
    OPEN_MODEL_SWITCHER: "open-model-switcher",
  },
}));

const mockStartNewChat = vi.fn();
vi.mock("./useAppOrchestration", () => ({
  useAppOrchestration: () => ({ startNewChat: mockStartNewChat }),
}));

const mockCopyToClipboard = vi.fn().mockResolvedValue(true);
vi.mock("../lib/clipboard", () => ({
  copyToClipboard: (...args: unknown[]) => mockCopyToClipboard(...args),
}));

import { useKeyboard } from "./useKeyboard";
import { useChatStore } from "../stores/chat";
import { useSettingsStore } from "../stores/settings";
import { appEvents, APP_EVENT } from "../lib/appEvents";

function fire(key: string, opts: KeyboardEventInit = {}) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...opts }),
  );
}

describe("useKeyboard", () => {
  let cleanup: () => void;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const kb = useKeyboard();
    cleanup = kb.cleanup;
  });

  afterEach(() => {
    cleanup?.();
  });

  it("Ctrl+/ toggles sidebarCollapsed", async () => {
    const settings = useSettingsStore();
    settings.sidebarCollapsed = false;
    fire("/", { ctrlKey: true });
    expect(settings.sidebarCollapsed).toBe(true);
    fire("/", { ctrlKey: true });
    expect(settings.sidebarCollapsed).toBe(false);
  });

  it("Ctrl+Shift+M toggles compactMode", () => {
    const settings = useSettingsStore();
    settings.compactMode = false;
    fire("M", { ctrlKey: true, shiftKey: true });
    expect(settings.compactMode).toBe(true);
    fire("M", { ctrlKey: true, shiftKey: true });
    expect(settings.compactMode).toBe(false);
  });

  it("Ctrl+, navigates to /settings", () => {
    fire(",", { ctrlKey: true });
    expect(mockRouterPush).toHaveBeenCalledWith("/settings");
  });

  it("Ctrl+H navigates to /settings connectivity tab", () => {
    fire("h", { ctrlKey: true });
    expect(mockRouterPush).toHaveBeenCalledWith({
      path: "/settings",
      query: { tab: "connectivity" },
    });
  });

  it("Ctrl+N navigates to /chat", () => {
    fire("n", { ctrlKey: true });
    expect(mockStartNewChat).toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith("/chat");
  });

  it("Ctrl+K dispatches focus-search event", () => {
    fire("k", { ctrlKey: true });
    expect(appEvents.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: APP_EVENT.FOCUS_SEARCH }),
    );
  });

  it("Ctrl+M dispatches open-model-switcher event", () => {
    fire("m", { ctrlKey: true });
    expect(appEvents.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: APP_EVENT.OPEN_MODEL_SWITCHER }),
    );
  });

  it("Ctrl+Shift+C copies last assistant message to clipboard", async () => {
    const chat = useChatStore();
    chat.conversations = [
      {
        id: "c1",
        model: "llama3",
        title: "T",
        settings_json: "{}",
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
    ];
    chat.activeConversationId = "c1";
    chat.messages = {
      c1: [
        {
          id: "1",
          role: "user",
          content: "hi",
          tokens: 0,
          prompt_tokens: 0,
          tokens_per_sec: 0,
          generation_time_ms: 0,
          total_duration_ms: 0,
          load_duration_ms: 0,
          prompt_eval_duration_ms: 0,
          eval_duration_ms: 0,
        },
        {
          id: "2",
          role: "assistant",
          content: "hello there",
          tokens: 0,
          prompt_tokens: 0,
          tokens_per_sec: 0,
          generation_time_ms: 0,
          total_duration_ms: 0,
          load_duration_ms: 0,
          prompt_eval_duration_ms: 0,
          eval_duration_ms: 0,
        },
      ],
    };

    fire("C", { ctrlKey: true, shiftKey: true });
    await Promise.resolve();
    expect(mockCopyToClipboard).toHaveBeenCalledWith("hello there");
  });

  it("Ctrl+↓ loads next conversation", () => {
    const chat = useChatStore();
    const convA = {
      id: "a",
      model: "m",
      title: "A",
      settings_json: "{}",
      pinned: false,
      tags: [],
      draft_json: null,
      created_at: "",
      updated_at: "",
    };
    const convB = {
      id: "b",
      model: "m",
      title: "B",
      settings_json: "{}",
      pinned: false,
      tags: [],
      draft_json: null,
      created_at: "",
      updated_at: "",
    };
    chat.conversations = [convA, convB];
    chat.activeConversationId = "a";
    const loadSpy = vi
      .spyOn(chat, "loadConversation")
      .mockResolvedValue(undefined as never);
    fire("ArrowDown", { ctrlKey: true });
    expect(loadSpy).toHaveBeenCalledWith("b");
  });

  it("Ctrl+↑ loads previous conversation", () => {
    const chat = useChatStore();
    const convA = {
      id: "a",
      model: "m",
      title: "A",
      settings_json: "{}",
      pinned: false,
      tags: [],
      draft_json: null,
      created_at: "",
      updated_at: "",
    };
    const convB = {
      id: "b",
      model: "m",
      title: "B",
      settings_json: "{}",
      pinned: false,
      tags: [],
      draft_json: null,
      created_at: "",
      updated_at: "",
    };
    chat.conversations = [convA, convB];
    chat.activeConversationId = "b";
    const loadSpy = vi
      .spyOn(chat, "loadConversation")
      .mockResolvedValue(undefined as never);
    fire("ArrowUp", { ctrlKey: true });
    expect(loadSpy).toHaveBeenCalledWith("a");
  });

  it("shortcuts are suppressed when a textarea is focused", () => {
    const settings = useSettingsStore();
    settings.sidebarCollapsed = false;
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();
    fire("/", { ctrlKey: true });
    expect(settings.sidebarCollapsed).toBe(false);
    ta.remove();
  });

  it("Escape calls stop_generation when streaming", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(undefined);
    const chat = useChatStore();
    chat.activeConversationId = "conv1";
    chat.streaming = {
      ...chat.streaming,
      isStreaming: true,
      currentConversationId: "conv1",
    };
    fire("Escape");
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("stop_generation");
  });

  it("Escape fires stop_generation even when textarea is focused", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(undefined);
    const chat = useChatStore();
    chat.activeConversationId = "conv1";
    chat.streaming = {
      ...chat.streaming,
      isStreaming: true,
      currentConversationId: "conv1",
    };
    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();
    fire("Escape");
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("stop_generation");
    ta.remove();
  });

  it("Escape does not call stop_generation when not streaming", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockResolvedValue(undefined);
    const chat = useChatStore();
    chat.streaming = { ...chat.streaming, isStreaming: false };
    fire("Escape");
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
  });
});
