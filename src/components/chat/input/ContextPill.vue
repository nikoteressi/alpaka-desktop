<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  contextTokens: number;
  maxContext: number;
}>();

const contextPercentage = computed(() => {
  if (props.maxContext === 0) return 0;
  return Math.min(100, (props.contextTokens / props.maxContext) * 100);
});
</script>

<template>
  <div
    v-if="contextTokens > 0"
    class="flex items-center gap-2 pr-2.5 border-r border-[var(--border-strong)]"
  >
    <div
      class="flex items-center gap-2 bg-[var(--bg-surface)]/50 px-2 py-0.5 rounded-full border border-[var(--border-strong)]/50 hover:bg-[var(--bg-elevated)] transition-colors cursor-help"
    >
      <svg
        class="w-2.5 h-2.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="
          contextPercentage > 90 ? 'text-red-400' : 'text-[var(--text-dim)]'
        "
      >
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="2" x2="9" y2="4" />
        <line x1="15" y1="2" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="22" />
        <line x1="15" y1="20" x2="15" y2="22" />
        <line x1="20" y1="9" x2="22" y2="9" />
        <line x1="20" y1="15" x2="22" y2="15" />
        <line x1="2" y1="9" x2="4" y2="9" />
        <line x1="2" y1="15" x2="4" y2="15" />
      </svg>
      <div class="flex items-baseline gap-1 whitespace-nowrap">
        <span
          class="text-[11px] font-bold tracking-tight transition-colors"
          :class="
            contextPercentage > 90 ? 'text-red-400' : 'text-[var(--text-muted)]'
          "
        >
          {{ contextTokens.toLocaleString() }}
        </span>
        <span class="text-[10px] font-semibold text-[var(--text-dim)]">/</span>
        <span class="text-[10px] font-semibold text-[var(--text-muted)]">
          {{ maxContext.toLocaleString() }}
        </span>
      </div>
    </div>
  </div>
</template>
