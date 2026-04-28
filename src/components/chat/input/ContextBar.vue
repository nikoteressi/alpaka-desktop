<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  contextTokens: number;
  maxContext: number;
  isStreaming: boolean;
}>();

const contextPercentage = computed(() => {
  if (props.maxContext === 0) return 0;
  return Math.min(100, (props.contextTokens / props.maxContext) * 100);
});
</script>

<template>
  <div
    v-if="contextTokens > 0"
    class="absolute top-0 left-0 right-0 h-[2px] bg-[var(--bg-input)] z-10"
  >
    <!-- Background shimmer during generation (full width) -->
    <div
      v-if="isStreaming"
      class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer z-0"
    />

    <!-- Progress bar -->
    <div
      class="h-full bg-gradient-to-r from-[#4a80d0]/60 via-[#6aa0f0]/80 to-[#4a80d0]/60 shadow-[0_0_12px_rgba(74,128,208,0.4)] transition-all duration-700 ease-out relative z-10"
      :style="{ width: contextPercentage + '%' }"
    >
      <!-- Shimmer focused on the filled part (optional, but keeping it subtle) -->
      <div
        v-if="isStreaming"
        class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
      />
    </div>
  </div>
</template>

<style scoped>
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
.animate-shimmer {
  animation: shimmer 2s infinite;
}
</style>
