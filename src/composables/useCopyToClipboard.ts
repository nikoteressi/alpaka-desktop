import { ref, onUnmounted } from "vue";

export function useCopyToClipboard(durationMs = 1500) {
  const copied = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copied.value = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        copied.value = false;
      }, durationMs);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }

  onUnmounted(() => {
    if (timer) clearTimeout(timer);
  });

  return { copied, copy };
}
