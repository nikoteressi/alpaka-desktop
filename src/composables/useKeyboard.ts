import { useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chat";
import { useSettingsStore } from "../stores/settings";
import { useAppOrchestration } from "./useAppOrchestration";
import { appEvents, APP_EVENT } from "../lib/appEvents";
import { copyToClipboard } from "../lib/clipboard";

function isFocusedOnInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

interface ShortcutCtx {
  router: ReturnType<typeof useRouter>;
  chatStore: ReturnType<typeof useChatStore>;
  settingsStore: ReturnType<typeof useSettingsStore>;
  orchestration: ReturnType<typeof useAppOrchestration>;
  navigateConversation: (delta: 1 | -1) => void;
}

interface Shortcut {
  key: string;
  shift: boolean;
  ignoreWhenInputFocused?: boolean;
  run: (ctx: ShortcutCtx) => void;
}

const SHORTCUTS: Shortcut[] = [
  {
    key: "c",
    shift: true,
    run: ({ chatStore }) => {
      const messages = chatStore.activeMessages;
      const last = [...messages].reverse().find((m) => m.role === "assistant");
      if (last?.content) copyToClipboard(last.content);
    },
  },
  {
    key: "/",
    shift: false,
    ignoreWhenInputFocused: true,
    run: ({ settingsStore }) =>
      settingsStore.updateSetting(
        "sidebarCollapsed",
        !settingsStore.sidebarCollapsed,
      ),
  },
  {
    key: "m",
    shift: true,
    ignoreWhenInputFocused: true,
    run: ({ settingsStore }) =>
      settingsStore.updateSetting("compactMode", !settingsStore.compactMode),
  },
  {
    key: ",",
    shift: false,
    ignoreWhenInputFocused: true,
    run: ({ router }) => {
      router.push("/settings");
    },
  },
  {
    key: "h",
    shift: false,
    ignoreWhenInputFocused: true,
    run: () => appEvents.dispatchEvent(new Event(APP_EVENT.OPEN_HOST_MANAGER)),
  },
  {
    key: "n",
    shift: false,
    ignoreWhenInputFocused: true,
    run: ({ orchestration, router }) => {
      orchestration.startNewChat();
      router.push("/chat");
    },
  },
  {
    key: "k",
    shift: false,
    ignoreWhenInputFocused: true,
    run: () => appEvents.dispatchEvent(new Event(APP_EVENT.FOCUS_SEARCH)),
  },
  {
    key: "m",
    shift: false,
    ignoreWhenInputFocused: true,
    run: () =>
      appEvents.dispatchEvent(new Event(APP_EVENT.OPEN_MODEL_SWITCHER)),
  },
  {
    key: "arrowdown",
    shift: false,
    ignoreWhenInputFocused: true,
    run: ({ navigateConversation }) => navigateConversation(1),
  },
  {
    key: "arrowup",
    shift: false,
    ignoreWhenInputFocused: true,
    run: ({ navigateConversation }) => navigateConversation(-1),
  },
];

function handleEscape(
  e: KeyboardEvent,
  chatStore: ReturnType<typeof useChatStore>,
): boolean {
  if (e.key !== "Escape") return false;
  if (chatStore.isStreamingForActiveConv) {
    e.preventDefault();
    invoke("stop_generation").catch(() => {});
  }
  return true;
}

export function useKeyboard() {
  const router = useRouter();
  const chatStore = useChatStore();
  const settingsStore = useSettingsStore();
  const orchestration = useAppOrchestration();

  function navigateConversation(delta: 1 | -1) {
    const convs = chatStore.conversations;
    if (convs.length === 0) return;
    const idx = convs.findIndex((c) => c.id === chatStore.activeConversationId);
    const next = idx + delta;
    if (next >= 0 && next < convs.length) {
      chatStore.loadConversation(convs[next].id);
    }
  }

  const ctx: ShortcutCtx = {
    router,
    chatStore,
    settingsStore,
    orchestration,
    navigateConversation,
  };

  function handler(e: KeyboardEvent) {
    if (handleEscape(e, chatStore)) return;
    if (!(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    const shift = e.shiftKey;
    const match = SHORTCUTS.find((s) => s.key === key && s.shift === shift);
    if (!match) return;
    if (match.ignoreWhenInputFocused && isFocusedOnInput()) return;
    e.preventDefault();
    match.run(ctx);
  }

  function cleanup() {
    globalThis.removeEventListener("keydown", handler, { capture: true });
  }

  globalThis.addEventListener("keydown", handler, { capture: true });

  return { cleanup };
}
