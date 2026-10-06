<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import BaseModal from "../shared/BaseModal.vue";

const props = defineProps<{
  open: boolean;
  initialContent: string;
}>();

const emit = defineEmits<{
  confirm: [content: string];
  cancel: [];
}>();

const content = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);

watch(
  () => props.open,
  async (v) => {
    if (v) {
      content.value = props.initialContent;
      await nextTick();
      textareaRef.value?.focus();
      const len = textareaRef.value?.value.length ?? 0;
      textareaRef.value?.setSelectionRange(len, len);
    }
  },
);

function confirm() {
  const trimmed = content.value.trim();
  if (!trimmed || trimmed === props.initialContent) return;
  emit("confirm", trimmed);
}

function cancel() {
  emit("cancel");
}
</script>

<template>
  <BaseModal
    :show="open"
    title="Edit message"
    max-width="560px"
    @close="cancel"
  >
    <div class="px-5 py-4">
      <textarea
        ref="textareaRef"
        v-model="content"
        class="w-full bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-xl px-3 py-2.5 text-[14px] text-[var(--text)] leading-relaxed resize-none outline-none font-[inherit] focus:border-[var(--border-focus,var(--border-strong))]"
        rows="6"
        @keydown.ctrl.enter="confirm"
        @keydown.meta.enter="confirm"
      />
    </div>

    <template #footer>
      <button
        class="px-5 py-2.5 rounded-xl text-[13px] font-medium text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all active:scale-[0.98]"
        @click="cancel"
      >
        Cancel
      </button>
      <button
        class="px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98] text-[var(--text)] bg-[var(--bg-elevated)] border border-[var(--border-strong)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="!content.trim() || content.trim() === initialContent"
        @click="confirm"
      >
        Send
      </button>
    </template>
  </BaseModal>
</template>
