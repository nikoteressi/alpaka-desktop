import { useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { useChatStore } from "../stores/chat";
import { useSettingsStore } from "../stores/settings";
import { useAppOrchestration } from "./useAppOrchestration";
import { appEvents, APP_EVENT } from "../lib/appEvents";

function isFocusedOnInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    (el as HTMLElement).isContentEditable
  );
}

export function useKeyboard() {
  const router = useRouter();
  const chatStore = useChatStore();
  const settingsStore = useSettingsStore();
  const orchestration = useAppOrchestration();

  function handler(e: KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key = e.key.toLowerCase();

    // Escape: always fires, no focus guard
    if (e.key === "Escape") {
      if (chatStore.streaming.isStreaming) {
        e.preventDefault();
        Promise.resolve(invoke("stop_generation")).catch(() => {});
      }
      return;
    }

    if (!ctrl) return;
    if (isFocusedOnInput()) return;

    if (key === "/" && !shift) {
      e.preventDefault();
      settingsStore.updateSetting(
        "sidebarCollapsed",
        !settingsStore.sidebarCollapsed,
      );
      return;
    }

    if (key === "m" && shift) {
      e.preventDefault();
      settingsStore.updateSetting("compactMode", !settingsStore.compactMode);
      return;
    }

    if (key === "," && !shift) {
      e.preventDefault();
      router.push("/settings");
      return;
    }

    if (key === "h" && !shift) {
      e.preventDefault();
      router.push("/settings");
      return;
    }

    if (key === "n" && !shift) {
      e.preventDefault();
      orchestration.startNewChat();
      router.push("/chat");
      return;
    }

    if (key === "k" && !shift) {
      e.preventDefault();
      appEvents.dispatchEvent(new Event(APP_EVENT.FOCUS_SEARCH));
      return;
    }

    if (key === "m" && !shift) {
      e.preventDefault();
      appEvents.dispatchEvent(new Event(APP_EVENT.OPEN_MODEL_SWITCHER));
      return;
    }

    if (key === "c" && shift) {
      e.preventDefault();
      const messages = chatStore.activeMessages;
      const last = [...messages].reverse().find((m) => m.role === "assistant");
      if (last?.content) {
        navigator.clipboard.writeText(last.content).catch(() => {});
      }
      return;
    }

    if (e.key === "ArrowDown" && !shift) {
      e.preventDefault();
      navigateConversation(1);
      return;
    }

    if (e.key === "ArrowUp" && !shift) {
      e.preventDefault();
      navigateConversation(-1);
      return;
    }
  }

  function navigateConversation(delta: 1 | -1) {
    const convs = chatStore.conversations;
    if (convs.length === 0) return;
    const idx = convs.findIndex((c) => c.id === chatStore.activeConversationId);
    const next = idx + delta;
    if (next >= 0 && next < convs.length) {
      chatStore.loadConversation(convs[next].id);
    }
  }

  function cleanup() {
    window.removeEventListener("keydown", handler, { capture: true });
  }

  window.addEventListener("keydown", handler, { capture: true });

  return { cleanup };
}
