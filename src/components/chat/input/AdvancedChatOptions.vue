<template>
  <div
    class="p-4 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-xl w-64 flex flex-col gap-4"
  >
    <div
      class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-1"
    >
      <span
        class="text-[12px] font-bold text-[var(--text)] uppercase tracking-wider"
        >Advanced Options</span
      >
      <button
        @click="$emit('reset')"
        class="text-[10px] text-[var(--accent)] font-bold hover:underline cursor-pointer"
      >
        Reset to Global
      </button>
    </div>

    <SettingsSlider
      label="Temperature"
      :model-value="
        modelValue.temperature ?? settingsStore.chatOptions.temperature
      "
      @update:model-value="updateOption('temperature', $event)"
      :min="0"
      :max="1"
      :step="0.1"
      subtitle="Higher = creative & random; Lower = focused & deterministic."
      :show-badge="modelValue.temperature === undefined"
      compact
    />

    <SettingsSlider
      label="Top P"
      :model-value="modelValue.top_p ?? settingsStore.chatOptions.top_p"
      @update:model-value="updateOption('top_p', $event)"
      :min="0"
      :max="1"
      :step="0.05"
      subtitle="Filters choices by cumulative probability. Lower = narrower focus."
      :show-badge="modelValue.top_p === undefined"
      compact
    />

    <SettingsSlider
      label="Top K"
      :model-value="modelValue.top_k ?? settingsStore.chatOptions.top_k"
      @update:model-value="updateOption('top_k', $event)"
      :min="0"
      :max="100"
      :step="1"
      subtitle="Limits the pool of words to Top K. Prevents weird outliers."
      :show-badge="modelValue.top_k === undefined"
      compact
    />

    <SettingsSlider
      label="Repeat Penalty"
      :model-value="
        modelValue.repeat_penalty ?? settingsStore.chatOptions.repeat_penalty
      "
      @update:model-value="updateOption('repeat_penalty', $event)"
      :min="1"
      :max="2"
      :step="0.05"
      subtitle="Deters repeating phrases. 1.1–1.2 is a good range."
      :show-badge="modelValue.repeat_penalty === undefined"
      compact
    />

    <div class="border-t border-[var(--border-subtle)] pt-3 mt-1">
      <SettingsSlider
        label="Repeat Last N"
        :model-value="
          modelValue.repeat_last_n ?? settingsStore.chatOptions.repeat_last_n
        "
        @update:model-value="updateOption('repeat_last_n', $event)"
        :min="0"
        :max="128"
        :step="8"
        subtitle="How far back the model looks to prevent repeating itself."
        :show-badge="modelValue.repeat_last_n === undefined"
        compact
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from "../../../stores/settings";
import type { ChatOptions } from "../../../types/settings";
import SettingsSlider from "../../settings/SettingsSlider.vue";

const props = defineProps<{
  modelValue: Partial<ChatOptions>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: Partial<ChatOptions>): void;
  (e: "reset"): void;
}>();

const settingsStore = useSettingsStore();

function updateOption(key: keyof ChatOptions, value: number) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}
</script>

<style scoped></style>
