<template>
  <div class="flex flex-col gap-1.5 group/opt">
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-1.5 min-w-0">
        <label
          :for="sliderId"
          class="text-[11.5px] font-medium text-[var(--text-muted)] truncate"
          >{{ label }}</label
        >
        <span
          v-if="showBadge"
          class="flex-shrink-0 text-[9px] px-1 py-0.5 rounded bg-[var(--bg-active)] text-[var(--text-dim)] uppercase tracking-tighter"
          >Global</span
        >
      </div>
      <span
        class="text-[11px] font-mono text-[var(--text-dim)] flex-shrink-0"
        >{{ formattedValue }}</span
      >
    </div>

    <p
      v-if="subtitle"
      class="text-[9.5px] text-[var(--text-dim)] leading-tight transition-all duration-200"
      :class="[
        compact
          ? 'opacity-0 h-0 group-hover/opt:opacity-100 group-hover/opt:h-auto group-hover/opt:mb-0.5'
          : 'mb-0.5',
      ]"
    >
      {{ subtitle }}
    </p>

    <input
      :id="sliderId"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="onInput"
      class="custom-slider"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from "vue";

const sliderId = useId();

const props = defineProps<{
  label: string;
  modelValue: number;
  min: number;
  max: number;
  step: number;
  subtitle?: string;
  showBadge?: boolean;
  compact?: boolean;
  formatValue?: (val: number) => string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", val: number): void;
}>();

const formattedValue = computed(() => {
  if (props.formatValue) return props.formatValue(props.modelValue);
  return props.modelValue.toString();
});

const onInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  emit(
    "update:modelValue",
    props.step % 1 === 0 ? Number.parseInt(val, 10) : Number.parseFloat(val),
  );
};
</script>

<style scoped>
.custom-slider {
  width: 100%;
  height: 4px;
  background: var(--bg-active);
  border-radius: 2px;
  appearance: none;
  outline: none;
  cursor: pointer;
}
.custom-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: var(--accent);
  border-radius: 50%;
  transition: transform 0.1s;
}
.custom-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}
</style>
