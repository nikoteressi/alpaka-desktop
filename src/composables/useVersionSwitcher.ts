import { computed } from "vue";
import { useChatStore } from "../stores/chat";
import type { Message } from "../types/chat";

export function useVersionSwitcher(getMessage: () => Message) {
  const store = useChatStore();

  const hasPrev = computed(() => (getMessage().siblingOrder ?? 0) > 0);
  const hasNext = computed(
    () =>
      (getMessage().siblingOrder ?? 0) < (getMessage().siblingCount ?? 1) - 1,
  );
  const versionLabel = computed(() => {
    const msg = getMessage();
    if ((msg.siblingCount ?? 1) <= 1) return null;
    return `${(msg.siblingOrder ?? 0) + 1} / ${msg.siblingCount ?? 1}`;
  });

  async function prevVersion() {
    const msg = getMessage();
    if (!hasPrev.value || !msg.id) return;
    await store.navigateVersion(msg.id, -1);
  }

  async function nextVersion() {
    const msg = getMessage();
    if (!hasNext.value || !msg.id) return;
    await store.navigateVersion(msg.id, 1);
  }

  return { hasPrev, hasNext, versionLabel, prevVersion, nextVersion };
}
