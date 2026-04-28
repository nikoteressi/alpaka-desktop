import { ref, type Ref } from "vue";

export function useAutoScroll(containerRef: Ref<HTMLElement | null>) {
  const isAtBottom = ref(true);

  function scrollToBottom(smooth = false) {
    const el = containerRef.value;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
  }

  function onScroll() {
    const el = containerRef.value;
    if (!el) return;
    isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }

  return { isAtBottom, scrollToBottom, onScroll };
}
