<script setup lang="ts">
const props = defineProps<{
  modelValue: 0 | 1 | 2;
  compact?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: 0 | 1 | 2): void;
}>();

const options = [
  { value: 0 as const, label: "Off" },
  { value: 1 as const, label: "Mirostat 1" },
  { value: 2 as const, label: "Mirostat 2" },
];
</script>

<template>
  <div class="flex flex-col" :class="compact ? 'gap-1.5' : 'gap-2'">
    <span
      class="font-medium text-[var(--text-muted)]"
      :class="compact ? 'text-[11px]' : 'text-[12px]'"
      >Sampling Mode</span
    >
    <div class="flex rounded-lg overflow-hidden border border-[var(--border)]">
      <button
        v-for="opt in options"
        :key="opt.value"
        @click="emit('update:modelValue', opt.value)"
        class="flex-1 font-medium transition-colors cursor-pointer"
        :class="[
          compact ? 'py-1 text-[10px]' : 'py-1.5 text-[11px]',
          modelValue === opt.value
            ? 'bg-[var(--accent)] text-white'
            : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]',
        ]"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
