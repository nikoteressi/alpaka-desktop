<template>
  <div class="flex flex-col gap-2" role="tabpanel">
    <div
      v-if="modelStore.isLoading"
      class="text-[13px] text-[var(--text-dim)] py-12 text-center"
    >
      <div
        class="inline-block w-5 h-5 border-2 border-[var(--border-strong)] border-t-[#4a80d0] rounded-full animate-spin mb-3"
      ></div>
      <p>Loading installed models...</p>
    </div>
    <div
      v-else-if="modelStore.error"
      class="flex flex-col items-center gap-3 text-[13px] py-12 text-center bg-[var(--bg-input)] border border-dashed border-[var(--danger)]/40 rounded-xl"
    >
      <span class="text-[var(--danger)]"
        >Failed to load models: {{ modelStore.error }}</span
      >
      <button
        @click="modelStore.fetchModels()"
        class="px-4 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-lg text-[12px] text-[var(--text)] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
      >
        Retry
      </button>
    </div>
    <div
      v-else-if="modelStore.models.length === 0"
      class="flex flex-col items-center gap-3 text-[13px] py-12 text-center bg-[var(--bg-input)] border border-dashed border-[var(--border-subtle)] rounded-xl"
    >
      <span class="text-[var(--text-dim)]"
        >No models installed locally. Go to Library to pull one!</span
      >
      <button
        @click="modelStore.fetchModels()"
        class="px-4 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-lg text-[12px] text-[var(--text)] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
      >
        Refresh
      </button>
    </div>
    <div v-else class="flex flex-col gap-1.5">
      <p
        class="text-[11px] text-[var(--text-dim)] font-bold uppercase tracking-wider px-1 mb-1"
      >
        {{ modelStore.models.length }} Installed Models
      </p>
      <!-- Tag filter bar — always visible when models exist -->
      <div class="flex flex-wrap gap-1.5 mb-3 items-center">
        <button
          class="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
          :class="
            activeTagFilter === null
              ? 'bg-[var(--accent)] text-white border-transparent'
              : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]'
          "
          @click="activeTagFilter = null"
        >
          All
        </button>
        <button
          v-for="tag in modelStore.allFilterableTags"
          :key="tag"
          class="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
          :class="
            activeTagFilter === tag
              ? 'bg-[var(--accent)] text-white border-transparent'
              : 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)]'
          "
          @click="activeTagFilter = tag"
        >
          {{ tag }}
        </button>
        <span
          v-if="modelStore.allFilterableTags.length === 0"
          class="text-[11px] text-[var(--text-dim)] italic"
          >Use the tag icon on a model card to add tags</span
        >
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          v-for="model in filteredLocalModels"
          :key="'wrap-' + model.name"
          class="flex flex-col gap-1"
        >
          <ModelCard
            :name="modelBaseName(model.name as string)"
            :tags="[
              model.details.parameter_size,
              ...getActiveCaps(model.name as string),
            ]"
            :file-size="formatSize(model.size)"
            :date="formatDateShort(model.modified_at)"
            :quant="model.details.quantization_level"
            :is-installed="true"
            :is-favorite="modelStore.isFavorite(model.name as string)"
            :on-favorite="() => modelStore.toggleFavorite(model.name as string)"
            :user-tags="modelStore.getUserTags(model.name as string)"
            :on-click="() => $emit('open-model', model.name as string)"
            :on-delete="() => $emit('delete-model', model.name as string)"
            :on-edit-tags="() => openTagEditor(model.name as string)"
            action-label="Run"
          />
          <!-- Inline tag editor -->
          <div
            v-if="editingTagsFor === model.name"
            class="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl animate-in fade-in duration-150"
          >
            <input
              v-model="tagInputValue"
              type="text"
              placeholder="Add tags, comma-separated (e.g. code, fast)"
              class="flex-1 bg-transparent text-[12px] text-[var(--text)] placeholder-[var(--text-dim)] outline-none"
              @keydown.enter="saveTagsFor(model.name as string)"
              @keydown.escape="editingTagsFor = null"
            />
            <button
              @click="saveTagsFor(model.name as string)"
              class="text-[11px] font-bold text-[var(--accent)] hover:opacity-80 transition-opacity"
            >
              Save
            </button>
            <button
              @click="editingTagsFor = null"
              class="text-[11px] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import ModelCard from "../../components/models/ModelCard.vue";
import { useModelStore, modelMatchesTag } from "../../stores/models";

defineEmits<{
  (e: "open-model", name: string): void;
  (e: "delete-model", name: string): void;
}>();

const modelStore = useModelStore();

const activeTagFilter = ref<string | null>(null);
const editingTagsFor = ref<string | null>(null);
const tagInputValue = ref("");

const filteredLocalModels = computed(() => {
  const sorted = modelStore.sortedModels;
  if (!activeTagFilter.value) return sorted;
  return sorted.filter((m) =>
    modelMatchesTag(
      m.name,
      activeTagFilter.value!,
      modelStore.modelUserData,
      modelStore.capabilities[m.name],
    ),
  );
});

function openTagEditor(name: string) {
  editingTagsFor.value = name;
  const existing = modelStore.getUserTags(name);
  tagInputValue.value = existing.join(", ");
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

function getActiveCaps(name: string) {
  const caps = modelStore.capabilities[name];
  if (!caps) return [];
  const tags: string[] = [];
  if (caps.vision) tags.push("vision");
  if (caps.tools) tags.push("tools");
  if (caps.thinking) tags.push("thinking");
  return tags;
}

function modelBaseName(name: string) {
  return name.split(":")[0];
}

function formatSize(bytes: number) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + " GB";
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + " MB";
  return bytes + " B";
}

function formatDateShort(dateStr: string) {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
</script>
