<template>
  <div
    ref="triggerRef"
    class="min-w-0 overflow-hidden"
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
}>();

const triggerRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);
const position = ref({ x: 0, y: 0 });

const handleMouseEnter = () => {
  if (!triggerRef.value) return;

  // Check for truncation if requested
  if (props.onlyIfTruncated) {
    const el =
      triggerRef.value.querySelector(".truncate") ||
      triggerRef.value.firstElementChild;
    if (el instanceof HTMLElement) {
      if (el.scrollWidth <= el.offsetWidth) return;
    }
  }

  const rect = triggerRef.value.getBoundingClientRect();

  // Position below the element
  position.value = {
    x: rect.left,
    y: rect.bottom + 8,
  };

  isVisible.value = true;
};

const tooltipStyle = computed(() => {
  // Ensure it doesn't go off screen
  let x = position.value.x;
  let y = position.value.y;

  // If it would go off the right edge, shift it left
  if (x + 300 > window.innerWidth) {
    x = Math.max(10, window.innerWidth - 310);
  }

  // If it would go off the bottom edge, show it above the trigger
  if (y + 100 > window.innerHeight) {
    y = y - 60; // 60px is an estimate, ideally we'd measure
  }

  return {
    left: `${x}px`,
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
