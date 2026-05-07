import { computed } from "vue";
import { useChatStore } from "../stores/chat";
import type { Message } from "../types/chat";

export function useVersionSwitcher(message: Message) {
  const store = useChatStore();

  const allMessages = computed((): Message[] =>
    store.activeConversationId
      ? (store.messages[store.activeConversationId] ?? [])
      : [],
  );

  const siblings = computed((): Message[] => {
    if (!message.parentId) return [];
    return allMessages.value
      .filter((m: Message) => m.parentId === message.parentId)
      .sort(
        (a: Message, b: Message) =>
          (a.siblingOrder ?? 0) - (b.siblingOrder ?? 0),
      );
  });

  const currentIndex = computed(() =>
    siblings.value.findIndex((m: Message) => m.id === message.id),
  );

  const hasPrev = computed(() => currentIndex.value > 0);
  const hasNext = computed(
    () => currentIndex.value < siblings.value.length - 1,
  );
  const versionLabel = computed(() => {
    if (siblings.value.length <= 1) return null;
    return `${currentIndex.value + 1} / ${siblings.value.length}`;
  });

  async function prevVersion() {
    if (!hasPrev.value) return;
    const prev = siblings.value[currentIndex.value - 1];
    if (prev.id) await store.switchVersion(prev.id);
  }

  async function nextVersion() {
    if (!hasNext.value) return;
    const next = siblings.value[currentIndex.value + 1];
    if (next.id) await store.switchVersion(next.id);
  }

  return { hasPrev, hasNext, versionLabel, prevVersion, nextVersion };
}
