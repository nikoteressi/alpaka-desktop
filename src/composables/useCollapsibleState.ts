import { ref } from "vue";
import { useChatStore } from "../stores/chat";

// Module-level cache shared across all instances.
// Survives remounts caused by DynamicScroller's ResizeObserver reassigning pool slots.
// Keyed by "${conversationId}-${messageKey}[-suffix]" to prevent cross-conversation collisions.
const _collapseCache = new Map<string, boolean>();

export interface UseCollapsibleStateOptions {
  /** The stable message identifier (e.g. message.id). Pass null/undefined for transient streaming state. */
  messageKey?: string | null;
  /** Optional suffix to namespace cache keys when multiple collapsibles share the same messageKey. */
  suffix?: string;
  /** Default open state when no cached state exists. */
  initialOpen?: boolean;
}

export function useCollapsibleState(options: UseCollapsibleStateOptions = {}) {
  const { messageKey, suffix, initialOpen = false } = options;

  // Guard against test environments where Pinia may not be set up
  let chatStore: ReturnType<typeof useChatStore> | null = null;
  try {
    chatStore = useChatStore();
  } catch {
    // Pinia not available (e.g. unit tests without full app setup) — cache keys disabled
  }

  function buildCacheKey(): string | null {
    if (!messageKey || messageKey === "msg-streaming-active") return null;
    const convId = chatStore?.activeConversationId;
    if (!convId) return null;
    return suffix
      ? `${convId}-${messageKey}-${suffix}`
      : `${convId}-${messageKey}`;
  }

  const key = buildCacheKey();
  const isOpen = ref<boolean>(
    key !== null ? (_collapseCache.get(key) ?? initialOpen) : initialOpen,
  );

  function toggle() {
    isOpen.value = !isOpen.value;
    const k = buildCacheKey();
    if (k) {
      _collapseCache.set(k, isOpen.value);
    }
  }

  function setOpen(value: boolean) {
    isOpen.value = value;
    const k = buildCacheKey();
    if (k) {
      _collapseCache.set(k, value);
    }
  }

  return { isOpen, toggle, setOpen };
}
