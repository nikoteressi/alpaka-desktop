import { ref, onUnmounted } from "vue";
import { copyToClipboard } from "../lib/clipboard";

export function useCopyToClipboard(durationMs = 1500) {
  const copied = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function copy(text: string): Promise<void> {
    const success = await copyToClipboard(text);
    if (success) {
      copied.value = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        copied.value = false;
      }, durationMs);
    }
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer);
  });

  return { copied, copy };
}
