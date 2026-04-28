<script setup lang="ts">
defineProps<{
  isOpen: boolean;
  systemPromptDraft: string;
}>();

const emit = defineEmits<{
  (e: "update:systemPromptDraft", val: string): void;
  (e: "save"): void;
  (e: "cancel"): void;
}>();

function onInput(e: Event) {
  emit("update:systemPromptDraft", (e.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <div
    v-if="isOpen"
    class="mb-1.5 px-3.5 py-2.5 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]"
  >
    <div
      class="text-[10px] text-[var(--text-dim)] uppercase tracking-wider font-semibold mb-1.5"
    >
      System Prompt
    </div>
    <textarea
      :value="systemPromptDraft"
      @input="onInput"
      rows="3"
      placeholder="You are a helpful assistant..."
      class="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-[12.5px] text-[var(--text)] resize-none outline-none leading-relaxed placeholder-[var(--text-dim)]"
    />
    <div class="flex gap-2 mt-1.5">
      <button
        @click="emit('save')"
        class="px-3 py-1 bg-[var(--bg-user-msg)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[12px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
      >
        Save
      </button>
      <button
        @click="emit('cancel')"
        class="px-3 py-1 text-[var(--text-muted)] text-[12px] cursor-pointer bg-transparent border-none hover:text-[var(--text-muted)] transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
</template>
