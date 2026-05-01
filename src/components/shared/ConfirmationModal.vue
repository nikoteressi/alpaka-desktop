<template>
  <BaseModal :show="show" :title="title" @close="cancel" max-width="360px">
    <div
      class="px-6 py-8 text-center bg-gradient-to-b from-transparent to-black/10"
    >
      <div
        v-if="kind === 'danger'"
        class="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
      >
        <svg
          class="w-7 h-7 text-[var(--danger)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"
          />
        </svg>
      </div>
      <div
        v-else
        class="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20"
      >
        <svg
          class="w-7 h-7 text-[var(--accent)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="8" />
        </svg>
      </div>

      <p
        class="text-[14px] text-[var(--text-muted)] leading-relaxed mx-auto max-w-[240px]"
      >
        {{ message }}
      </p>
    </div>

    <template #footer>
      <button
        @click="cancel"
        v-if="!hideCancel"
        class="px-5 py-2.5 rounded-xl text-[13px] font-medium text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-all active:scale-[0.98]"
      >
        {{ cancelLabel }}
      </button>
      <button
        @click="confirm"
        class="px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-[0.98] shadow-lg"
        :class="
          kind === 'danger'
            ? 'bg-[var(--danger)] text-white hover:bg-[var(--danger)] shadow-red-500/20'
            : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-blue-500/20'
        "
      >
        {{ confirmLabel }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from "./BaseModal.vue";

defineProps({
  show: Boolean,
  title: { type: String, default: "Confirm" },
  message: { type: String, default: "Are you sure you want to proceed?" },
  confirmLabel: { type: String, default: "Confirm" },
  cancelLabel: { type: String, default: "Cancel" },
  kind: { type: String, default: "primary" }, // 'primary' or 'danger'
  hideCancel: { type: Boolean, default: false },
});

const emit = defineEmits(["confirm", "cancel"]);

function confirm() {
  emit("confirm");
}

function cancel() {
  emit("cancel");
}
</script>
