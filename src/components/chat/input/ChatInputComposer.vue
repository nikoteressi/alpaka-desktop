<template>
  <textarea
    data-testid="chat-input"
    :value="modelValue"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    @keydown="$emit('keydown', $event)"
    placeholder="Type a message…"
    class="w-full bg-transparent focus:outline-none resize-none overflow-hidden text-[var(--text)] text-[13.5px] leading-relaxed placeholder-[var(--text-dim)] max-h-48 min-h-[36px]"
    :disabled="isStreaming"
    rows="1"
  />

  <div class="flex items-end justify-end mt-2">
    <div v-if="isStreaming" data-testid="streaming-indicator" style="display: none" />
    <button
      data-testid="send-btn"
      @click="$emit('submit')"
      :disabled="!isStreaming && !modelValue.trim() && !hasAttachments"
      :aria-label="isStreaming ? 'Stop generation' : 'Send message'"
      class="w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer disabled:opacity-30"
      :class="
        isStreaming
          ? 'bg-[var(--bg-user-msg)] hover:bg-[var(--bg-active)]'
          : modelValue.trim() || hasAttachments
            ? 'bg-[var(--text)] hover:bg-[var(--text-muted)]'
            : 'bg-[var(--bg-user-msg)]'
      "
    >
      <svg
        v-if="isStreaming"
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="currentColor"
        class="text-[var(--text)]"
      >
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
      <svg
        v-else
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        :stroke="modelValue.trim() || hasAttachments ? '#1a1a1a' : '#555'"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  </div>
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
