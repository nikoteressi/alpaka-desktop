<template>
  <div
    ref="triggerRef"
    :class="wrapperClass ?? 'min-w-0 overflow-hidden'"
    @mouseenter="handleMouseEnter"
    @mouseleave="isVisible = false"
  >
    <slot />

    <Teleport to="body">
      <Transition name="tooltip">
        <div
          v-if="isVisible"
          class="fixed z-[9999] px-3 py-1.5 text-[12px] bg-[var(--bg-surface)] text-[var(--text)] border border-[var(--border-strong)] rounded-md shadow-2xl pointer-events-none whitespace-normal break-words w-max max-w-[500px]"
          :style="tooltipStyle"
        >
          {{ text }}
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  text: string;
  onlyIfTruncated?: boolean;
  wrapperClass?: string;
}>();

const triggerRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);
const position = ref({
  left: 0,
  right: 0,
  y: 0,
  triggerTop: 0,
  nearRightEdge: false,
});

const handleMouseEnter = () => {
  if (!triggerRef.value) return;

  if (props.onlyIfTruncated) {
    const el =
      triggerRef.value.querySelector(".truncate") ||
      triggerRef.value.firstElementChild;
    if (el instanceof HTMLElement) {
      if (el.scrollWidth <= el.offsetWidth) return;
    }
  }

  const rect = triggerRef.value.getBoundingClientRect();
  const nearRightEdge = rect.left + 300 > window.innerWidth;

  position.value = {
    left: rect.left,
    right: window.innerWidth - rect.right,
    y: rect.bottom + 8,
    triggerTop: rect.top,
    nearRightEdge,
  };

  isVisible.value = true;
};

const TOOLTIP_HEIGHT_EST = 36;

const tooltipStyle = computed(() => {
  let y = position.value.y;

  if (y + TOOLTIP_HEIGHT_EST > window.innerHeight) {
    y = position.value.triggerTop - TOOLTIP_HEIGHT_EST - 8;
  }

  if (position.value.nearRightEdge) {
    return {
      right: `${Math.max(8, position.value.right)}px`,
      top: `${y}px`,
    };
  }

  return {
    left: `${position.value.left}px`,
    top: `${y}px`,
  };
});
</script>

<style scoped>
.tooltip-enter-active,
.tooltip-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
