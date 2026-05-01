<template>
  <div class="flex flex-col gap-2">
    <div v-if="modelValue.length > 0" class="flex flex-wrap gap-1.5">
      <span
        v-for="(seq, idx) in modelValue"
        :key="seq"
        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-active)] border border-[var(--border-strong)] text-[var(--text)] text-[11px] font-mono"
      >
        {{ seq }}
        <button
          type="button"
          @click="remove(idx)"
          class="text-[var(--text-dim)] hover:text-[var(--danger)] leading-none cursor-pointer border-none bg-transparent p-0 ml-0.5"
          aria-label="Remove stop sequence"
        >
          ×
        </button>
      </span>
    </div>

    <div class="flex items-center gap-2">
      <input
        v-model="draft"
        :disabled="atLimit"
        @keydown.enter.prevent="commit"
        @keydown.tab="onTab"
        :placeholder="
          atLimit
            ? `Limit reached (${MAX_STOP_SEQUENCES})`
            : 'e.g. ###   Press Enter to add'
        "
        class="custom-input flex-1 font-mono text-[12px]"
      />
      <span class="text-[11px] text-[var(--text-dim)] shrink-0 tabular-nums">
        {{ modelValue.length }}/{{ MAX_STOP_SEQUENCES }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const MAX_STOP_SEQUENCES = 4;

const props = defineProps<{ modelValue: string[] }>();
const emit = defineEmits<{ "update:modelValue": [value: string[]] }>();

const draft = ref("");

const atLimit = computed(() => props.modelValue.length >= MAX_STOP_SEQUENCES);

function commit() {
  const trimmed = draft.value.trim();
  if (!trimmed || atLimit.value) return;
  if (props.modelValue.includes(trimmed)) {
    draft.value = "";
    return;
  }
  emit("update:modelValue", [...props.modelValue, trimmed]);
  draft.value = "";
}

function onTab(e: KeyboardEvent) {
  if (!draft.value.trim()) return;
  e.preventDefault();
  commit();
}

function remove(idx: number) {
  const next = [...props.modelValue];
  next.splice(idx, 1);
  emit("update:modelValue", next);
}
</script>
