<template>
  <button
    class="relative w-10 h-[22px] rounded-full transition-colors cursor-pointer flex-shrink-0"
    :class="value ? 'bg-[var(--accent)]' : 'bg-[var(--bg-hover)]'"
    :style="
      value
        ? { border: '1px solid var(--accent)' }
        : { border: '1px solid var(--border)' }
    "
    @click="$emit('change', !value)"
  >
    <span
      class="absolute top-[3px] w-4 h-4 rounded-full transition-all"
      :style="value ? 'background: #fff' : 'background: var(--text-muted)'"
      :class="value ? 'left-[22px]' : 'left-[3px]'"
    />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  value: boolean;
}>();

defineEmits<{
  (e: "change", value: boolean): void;
}>();
</script>
