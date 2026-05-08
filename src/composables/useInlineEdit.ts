import { ref, onMounted } from "vue";
import { useChatStore } from "../stores/chat";

// Module-level cache shared across all instances.
// Survives remounts caused by DynamicScroller's ResizeObserver reassigning pool slots.
// Keyed by "${conversationId}-${messageKey}" to prevent cross-conversation collisions.
// Presence of a key means that message is currently in edit mode.
const _editCache = new Map<string, string>();

export interface UseInlineEditOptions {
  messageKey?: string | null;
  initialContent: () => string;
}

export function useInlineEdit(options: UseInlineEditOptions) {
  const { messageKey, initialContent } = options;

  let chatStore: ReturnType<typeof useChatStore> | null = null;
  try {
    chatStore = useChatStore();
  } catch {
    // Guard for test environments without a Pinia instance.
  }

  function buildCacheKey(): string | null {
    if (!messageKey) return null;
    const convId = chatStore?.activeConversationId;
    if (!convId) return null;
    return `${convId}-${messageKey}`;
  }

  const key = buildCacheKey();
  const isEditing = ref<boolean>(key !== null ? _editCache.has(key) : false);
  const editContent = ref<string>(
    key !== null ? (_editCache.get(key) ?? "") : "",
  );

  const editContainerRef = ref<HTMLElement | null>(null);
  const editTextareaRef = ref<HTMLTextAreaElement | null>(null);

  onMounted(() => {
    const k = buildCacheKey();
    if (k && _editCache.has(k)) {
      isEditing.value = true;
      editContent.value = _editCache.get(k) ?? "";
      // The container is always in DOM (v-show) but may still have display:none
      // from a previous render cycle. Force-show it so the textarea is visible.
      if (editContainerRef.value) editContainerRef.value.style.display = "flex";
      editTextareaRef.value?.focus();
    }
  });

  function startEdit() {
    editContent.value = initialContent();
    isEditing.value = true;
    const k = buildCacheKey();
    if (k) _editCache.set(k, editContent.value);
    // With v-show the container is always in DOM but hidden (display:none).
    // Override the style directly so el.focus() works within this same click
    // handler — WebKitGTK/Wayland silently ignores focus() called from microtasks.
    if (editContainerRef.value) editContainerRef.value.style.display = "flex";
    const el = editTextareaRef.value;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }

  function cancelEdit() {
    const k = buildCacheKey();
    if (k) _editCache.delete(k);
    isEditing.value = false;
    editContent.value = "";
  }

  function applyEdit(): string | null {
    const content = editContent.value.trim();
    if (!content) return null;
    const k = buildCacheKey();
    if (k) _editCache.delete(k);
    isEditing.value = false;
    editContent.value = "";
    return content;
  }

  function onInput() {
    const k = buildCacheKey();
    if (k) _editCache.set(k, editContent.value);
  }

  return {
    isEditing,
    editContent,
    editContainerRef,
    editTextareaRef,
    startEdit,
    cancelEdit,
    applyEdit,
    onInput,
  };
}
