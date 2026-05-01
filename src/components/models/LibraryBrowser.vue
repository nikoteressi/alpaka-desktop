<template>
  <div class="flex-1 flex flex-col gap-6">
    <!-- Search Bar Section -->
    <div
      class="bg-[var(--bg-surface)]/50 backdrop-blur-xl border border-[var(--border)] rounded-2xl p-5 shadow-2xl transition-all duration-300 hover:border-[var(--accent)]/20"
    >
      <div class="flex items-center gap-3 mb-4 px-1">
        <div
          class="w-8 h-8 rounded-lg bg-[var(--accent-muted)] border border-[var(--accent)]/20 flex items-center justify-center"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4a80d0"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div>
          <h2 class="text-[15px] font-bold text-[var(--text)]">
            Library Explorer
          </h2>
          <p class="text-[11px] text-[var(--text-muted)] font-medium">
            Browse thousands of models from Ollama repository
          </p>
        </div>
      </div>

      <div class="relative group">
        <input
          v-model="searchQuery"
          @input="onSearchInput"
          placeholder="Search models by name or category (e.g. llama3, coding, vision)..."
          class="w-full bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)]/50 rounded-xl px-5 py-3.5 text-[14px] text-[var(--text)] outline-none placeholder-[var(--text-dim)] transition-all shadow-inner group-hover:border-[var(--border-strong)]"
        />

        <div
          v-if="isSearching"
          class="absolute right-4 top-1/2 -translate-y-1/2"
        >
          <div
            class="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"
          />
        </div>
      </div>
    </div>

    <!-- Tag filter chips (only when results exist with tags) -->
    <div v-if="uniqueTags.length > 0" class="flex flex-wrap gap-1.5 -mt-2">
      <button
        class="text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
        :class="
          activeTagFilter === null
            ? 'bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/30'
            : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
        "
        @click="activeTagFilter = null"
      >
        All
      </button>
      <button
        v-for="tag in uniqueTags"
        :key="tag"
        class="text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors"
        :class="
          activeTagFilter === tag
            ? 'bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/30'
            : 'text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
        "
        @click="activeTagFilter = tag"
      >
        {{ tag }}
      </button>
    </div>

    <!-- Results Grid -->
    <div class="relative min-h-[400px]">
      <Transition name="fade-up" mode="out-in">
        <div
          v-if="filteredResults.length > 0"
          key="results"
          class="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <ModelCard
            v-for="model in filteredResults"
            :key="model.slug"
            :name="model.name"
            :description="model.description"
            :tags="model.tags"
            :pull-count="model.pull_count"
            :date="model.updated_at"
            :on-click="() => $emit('select', model)"
            action-label="Details"
          />
        </div>
        <div
          v-else-if="isSearching"
          key="loading"
          class="flex flex-col items-center justify-center py-24 gap-4"
        >
          <div
            class="w-10 h-10 border-2 border-[var(--accent)]/20 border-t-[#4a80d0] rounded-full animate-spin"
          />
          <p
            class="text-[13px] text-[var(--text-dim)] font-medium animate-pulse"
          >
            Searching repository...
          </p>
        </div>
        <div
          v-else-if="activeTagFilter && results.length > 0"
          key="tag-empty"
          class="flex flex-col items-center justify-center py-20 bg-[var(--bg-input)] border border-dashed border-[var(--border)] rounded-2xl"
        >
          <p class="text-[14px] text-[var(--text-dim)] font-medium">
            No models tagged "{{ activeTagFilter }}"
          </p>
          <button
            @click="activeTagFilter = null"
            class="mt-4 text-[12px] text-[var(--accent)] hover:underline font-bold"
          >
            Show all results
          </button>
        </div>
        <div
          v-else-if="searchQuery.length > 0"
          key="empty"
          class="flex flex-col items-center justify-center py-20 bg-[var(--bg-input)] border border-dashed border-[var(--border)] rounded-2xl"
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#333"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mb-4"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p class="text-[14px] text-[var(--text-dim)] font-medium">
            No models found for "{{ searchQuery }}"
          </p>
          <button
            @click="modelStore.clearLibrarySearch()"
            class="mt-4 text-[12px] text-[var(--accent)] hover:underline font-bold"
          >
            Clear search
          </button>
        </div>
        <div
          v-else
          key="empty-state"
          class="flex flex-col items-center justify-center py-20 bg-[var(--bg-input)]/50 border border-dashed border-[var(--border)] rounded-2xl"
        >
          <p class="text-[13px] text-[var(--text-dim)] font-medium">
            Enter a model name to start exploring
          </p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useModelStore } from "../../stores/models";
import { storeToRefs } from "pinia";
import ModelCard from "./ModelCard.vue";
import type { LibraryModel } from "../../types/models";

defineEmits<{
  (e: "select", model: LibraryModel): void;
}>();

const modelStore = useModelStore();
const {
  libraryResults: results,
  isSearching,
  searchQuery,
} = storeToRefs(modelStore);

const activeTagFilter = ref<string | null>(null);

const uniqueTags = computed(() => {
  const tagSet = new Set<string>();
  for (const m of results.value) {
    for (const t of m.tags ?? []) tagSet.add(t);
  }
  return [...tagSet].sort((a, b) => a.localeCompare(b));
});

const filteredResults = computed(() => {
  if (!activeTagFilter.value) return results.value;
  const f = activeTagFilter.value.toLowerCase();
  return results.value.filter((m) =>
    (m.tags ?? []).some((t) => t.toLowerCase() === f),
  );
});

function onSearchInput() {
  activeTagFilter.value = null;
  modelStore.searchLibrary(searchQuery.value);
}
</script>

<style scoped>
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
