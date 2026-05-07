<template>
  <textarea
    data-testid="chat-input"
    :value="modelValue"
    @input="
      $emit('update:modelValue', ($event.target as HTMLInputElement).value)
    "
    @keydown="$emit('keydown', $event)"
    placeholder="Type a message…"
    class="w-full bg-transparent focus:outline-none resize-none overflow-hidden text-[var(--text)] text-[13.5px] leading-relaxed placeholder-[var(--text-dim)] max-h-48 min-h-[36px]"
    :disabled="isStreaming"
    rows="1"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  isStreaming: boolean;
  hasAttachments: boolean;
}>();

defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "submit"): void;
  (e: "keydown", event: KeyboardEvent): void;
}>();
</script>
