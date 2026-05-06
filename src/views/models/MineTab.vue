<template>
  <div class="flex flex-col gap-3" role="tabpanel">
    <!-- Active Pushes -->
    <div
      v-if="Object.keys(modelStore.pushing).length > 0"
      class="flex flex-col gap-2 mb-2"
    >
      <p
        class="text-[11px] text-[var(--accent)] font-bold uppercase tracking-wider px-1"
      >
        Active Uploads
      </p>
      <div
        v-for="(prog, modelName) in modelStore.pushing"
        :key="'pushing-' + modelName"
        class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-[10px_14px]"
      >
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-[13px] text-[var(--text)] font-medium truncate">{{
            modelName
          }}</span>
          <span
            class="text-[12px] text-[var(--text-muted)] ml-2 flex-shrink-0"
            >{{ prog.status }}</span
          >
        </div>
        <div
          class="h-1 bg-[var(--bg-base)] rounded-sm overflow-hidden border border-white/5"
        >
          <div
            class="bg-[var(--accent)] h-1 rounded-sm transition-all"
            :style="{ width: prog.percent + '%' }"
          />
        </div>
      </div>
    </div>

    <!-- My namespaced models -->
    <div v-if="myModels.length > 0" class="flex flex-col gap-2">
      <ModelCard
        v-for="model in myModels"
        :key="model.name"
        :name="model.name as string"
        :tags="[
          model.details.parameter_size,
          ...getActiveCapTags(modelStore.capabilities[model.name as string]),
        ]"
        :file-size="formatSize(model.size)"
        :date="formatDateShort(model.modified_at)"
        :quant="model.details.quantization_level"
        :is-installed="true"
        :is-favorite="modelStore.isFavorite(model.name as string)"
        :on-favorite="() => modelStore.toggleFavorite(model.name as string)"
        :user-tags="modelStore.getUserTags(model.name as string)"
        :on-click="() => emit('open-model', model.name as string)"
        :on-delete="() => emit('delete-model', model.name as string)"
        :on-edit-tags="() => openTagEditor(model.name as string)"
        action-label="Run"
      />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="Object.keys(modelStore.pushing).length === 0"
      class="flex flex-col items-center justify-center py-12 text-center gap-3"
    >
      <p
        class="text-[13px] text-[var(--text-muted)] max-w-[280px] leading-relaxed"
      >
        No private models yet. Create one with a
        <code
          class="text-[var(--accent)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded"
          >username/modelname</code
        >
        name to enable cloud push.
      </p>
    </div>

    <!-- Inline tag editor -->
    <div
      v-if="editingTagsFor"
      class="bg-[var(--bg-surface)] border border-[var(--accent)] rounded-xl p-3 flex gap-2"
    >
      <input
        v-model="tagInputValue"
        class="flex-1 bg-[var(--bg-input)] border border-[var(--border)] rounded-lg px-2 py-1 text-[12px] text-[var(--text)] outline-none"
        placeholder="tag1, tag2"
        @keydown.enter="saveTagsFor(editingTagsFor)"
        @keydown.escape="editingTagsFor = null"
      />
      <button
        @click="saveTagsFor(editingTagsFor)"
        class="px-3 py-1 text-[12px] font-semibold text-white bg-[var(--accent)] rounded-lg hover:opacity-90"
      >
        Save
      </button>
    </div>

    <!-- Pull a private model by name -->
    <div class="mt-2 pt-4 border-t border-[var(--border)]">
      <p
        class="text-[11px] font-bold text-[var(--text-dim)] uppercase tracking-wider mb-2 px-1"
      >
        Pull a private model
      </p>
      <div class="flex gap-2">
        <input
          v-model="privateModelName"
          type="text"
          placeholder="username/modelname:tag"
          :disabled="!authStore.user || isPrivatePulling"
          class="flex-1 bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] rounded-xl px-3 py-2 text-[13px] text-[var(--text)] placeholder-[var(--text-dim)] outline-none transition-colors disabled:opacity-40"
          @keydown.enter="doPullPrivateModel"
        />
        <CustomTooltip
          :text="
            !authStore.user
              ? 'Sign in to your Ollama account'
              : isPrivatePulling
                ? 'Downloading…'
                : 'Pull model'
          "
          wrapper-class="inline-flex"
        >
          <button
            :disabled="
              !authStore.user || isPrivatePulling || !privateModelName.trim()
            "
            @click="doPullPrivateModel"
            class="flex items-center justify-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-[var(--accent)] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg
              v-if="!isPrivatePulling"
              class="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <svg
              v-else
              class="w-3.5 h-3.5 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-dasharray="56"
                stroke-dashoffset="14"
              />
            </svg>
            {{ isPrivatePulling ? "Pulling…" : "Pull" }}
          </button>
        </CustomTooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useModelStore } from "../../stores/models";
import { useAuthStore } from "../../stores/auth";
import type { ModelName } from "../../types/models";
import ModelCard from "../../components/models/ModelCard.vue";
import CustomTooltip from "../../components/shared/CustomTooltip.vue";
import {
  formatSize,
  formatDateShort,
  getActiveCapTags,
} from "../../lib/modelFormatters";

const emit = defineEmits<{
  "open-model": [name: string];
  "delete-model": [name: string];
}>();

const modelStore = useModelStore();
const authStore = useAuthStore();

const myModels = computed(() =>
  modelStore.models.filter((m) => m.name.includes("/")),
);

const privateModelName = ref("");
const pullingPrivateName = ref("");
const isPrivatePulling = computed(
  () =>
    !!pullingPrivateName.value &&
    !!modelStore.pulling[pullingPrivateName.value],
);

const editingTagsFor = ref<string | null>(null);
const tagInputValue = ref("");

async function doPullPrivateModel() {
  const name = privateModelName.value.trim();
  if (!name || !authStore.user || isPrivatePulling.value) return;
  pullingPrivateName.value = name;
  privateModelName.value = "";
  try {
    await modelStore.pullModel(name as ModelName);
  } finally {
    pullingPrivateName.value = "";
  }
}

function openTagEditor(name: string) {
  editingTagsFor.value = name;
  tagInputValue.value = modelStore.getUserTags(name).join(", ");
}

async function saveTagsFor(name: string) {
  const tags = tagInputValue.value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  await modelStore.setModelTags(name, tags);
  editingTagsFor.value = null;
  tagInputValue.value = "";
}
</script>
