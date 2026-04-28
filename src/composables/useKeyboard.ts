// NOTE: This composable is currently not used anywhere.
// Integrate into a component or remove when keyboard shortcuts are implemented.
import { onMounted, onUnmounted } from "vue";

type KeyHandler = (e: KeyboardEvent) => void;

export function useKeyboard(handlers: Record<string, KeyHandler>) {
  function handle(e: KeyboardEvent) {
    const parts = [
      e.ctrlKey && "Ctrl",
      e.metaKey && "Meta",
      e.shiftKey && "Shift",
      e.altKey && "Alt",
      e.key,
    ].filter(Boolean);
    const key = parts.join("+");
    handlers[key]?.(e);
  }

  onMounted(() => window.addEventListener("keydown", handle));
  onUnmounted(() => window.removeEventListener("keydown", handle));
}
