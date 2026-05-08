<script setup lang="ts">
import { ref, computed, watch } from "vue";
import BaseModal from "../../shared/BaseModal.vue";
import { tauriApi } from "../../../lib/tauri";

const props = defineProps<{
  show: boolean;
  contextId: string;
  contextName: string;
  contextPath: string;
  includedFiles: string[] | undefined;
}>();

const emit = defineEmits<{
  (e: "apply", files: string[], tokens: number, content: string): void;
  (e: "detach"): void;
  (e: "close"): void;
}>();

const allFiles = ref<string[]>([]);
const selected = ref<Set<string>>(new Set());
const loading = ref(false);
const applying = ref(false);
const loadError = ref<string | null>(null);
const applyError = ref<string | null>(null);

const noneSelected = computed(() => selected.value.size === 0);

const footerMeta = computed(() => {
  if (noneSelected.value) return "0 files selected";
  return `${selected.value.size} of ${allFiles.value.length} files`;
});

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    allFiles.value = await tauriApi.listFolderFiles(props.contextPath);
    const initial =
      props.includedFiles && props.includedFiles.length > 0
        ? props.includedFiles.filter((f) => allFiles.value.includes(f))
        : allFiles.value;
    selected.value = new Set(initial);
  } catch (err) {
    loadError.value =
      err instanceof Error ? err.message : "Failed to load files";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.show,
  (v) => {
    if (v) load();
  },
  { immediate: true },
);

function toggle(file: string) {
  if (selected.value.has(file)) {
    selected.value = new Set([...selected.value].filter((f) => f !== file));
  } else {
    selected.value = new Set([...selected.value, file]);
  }
}

async function handleApply() {
  applying.value = true;
  applyError.value = null;
  try {
    const files = [...selected.value];
    const result = await tauriApi.updateIncludedFiles(props.contextId, files);
    emit("apply", files, result.token_estimate, result.content);
  } catch (err) {
    applyError.value =
      err instanceof Error ? err.message : "Failed to apply selection";
  } finally {
    applying.value = false;
  }
}

function handleRemove() {
  emit("detach");
}

function handleClose() {
  emit("close");
}
</script>

<template>
  <BaseModal
    :show="show"
    :title="contextName"
    maxWidth="480px"
    @close="handleClose"
  >
    <div class="px-5 py-4">
      <p class="text-[12px] text-[var(--text-dim)] mb-3">
        Select files to include as context
      </p>

      <!-- Loading -->
      <div
        v-if="loading"
        class="flex items-center justify-center py-8 text-[var(--text-dim)] text-[12px]"
      >
        <svg class="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Loading files…
      </div>

      <!-- Error -->
      <div
        v-else-if="loadError"
        class="text-[12px] text-[var(--danger)] py-4 text-center"
      >
        {{ loadError }}
        <button
          class="block mx-auto mt-2 text-[var(--text-muted)] underline cursor-pointer"
          @click="load"
        >
          Retry
        </button>
      </div>

      <!-- File list -->
      <div v-else class="max-h-64 overflow-y-auto -mx-1">
        <label
          v-for="file in allFiles"
          :key="file"
          class="flex items-center gap-2.5 px-3 py-1.5 rounded-md cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          :class="
            selected.has(file) ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
          "
        >
          <input
            type="checkbox"
            :checked="selected.has(file)"
            class="flex-shrink-0 accent-[var(--text-muted)]"
            @change="toggle(file)"
          />
          <span class="font-mono text-[11px] truncate">{{ file }}</span>
        </label>
      </div>

      <!-- Destructive warning -->
      <p
        v-if="!loading && !loadError && noneSelected"
        class="text-[11px] text-[var(--danger)] mt-3"
      >
        No files selected — applying will remove this folder link.
      </p>

      <p
        v-if="applyError"
        class="text-[11px] text-[var(--danger)] mt-2"
      >
        {{ applyError }}
      </p>
    </div>

    <template #footer>
      <span class="text-[11px] text-[var(--text-dim)] mr-auto">
        {{ footerMeta }}
      </span>
      <button
        data-testid="btn-cancel"
        class="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        @click="handleClose"
      >
        Cancel
      </button>
      <button
        v-if="!noneSelected"
        data-testid="btn-apply"
        :disabled="applying"
        class="px-3 py-1.5 text-[12px] font-medium rounded-lg bg-[var(--bg-active)] border border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        @click="handleApply"
      >
        {{ applying ? "Applying…" : "Apply" }}
      </button>
      <button
        v-else
        data-testid="btn-remove"
        class="px-3 py-1.5 text-[12px] font-medium rounded-lg border text-[var(--danger)] transition-colors cursor-pointer"
        style="
          background: var(--danger-muted);
          border-color: color-mix(in srgb, var(--danger) 30%, transparent);
        "
        @click="handleRemove"
      >
        Remove folder link
      </button>
    </template>
  </BaseModal>
</template>
