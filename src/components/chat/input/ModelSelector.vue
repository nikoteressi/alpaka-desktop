<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { useModelStore } from "../../../stores/models";
import type { ModelName } from "../../../types/models";
import ModelTagBadge from "../../shared/ModelTagBadge.vue";

defineProps<{
  activeModelName: string;
  isActiveModelPulling: boolean;
}>();

const emit = defineEmits<{
  (e: "select", name: string): void;
  (e: "pull", name: string): void;
}>();

const modelStore = useModelStore();

const isModelDropdownOpen = ref(false);
const modelSearch = ref("");
const modelSelectorRef = ref<HTMLElement | null>(null);
const modelSearchInput = ref<HTMLInputElement | null>(null);

const allModelNames = computed(() => modelStore.models.map((m) => m.name));

const filteredInstalledModels = computed(() => {
  if (!modelSearch.value.trim()) return modelStore.models;
  const s = modelSearch.value.toLowerCase();
  return modelStore.models.filter((m) => m.name.toLowerCase().includes(s));
});

const filteredLibraryModels = computed(() => {
  if (!modelSearch.value.trim()) return [];
  const s = modelSearch.value.toLowerCase();
  return modelStore.libraryResults.filter(
    (m) =>
      !allModelNames.value.includes(m.name as ModelName) &&
      m.name.toLowerCase().includes(s),
  );
});

function openModelDropdown() {
  isModelDropdownOpen.value = !isModelDropdownOpen.value;
  if (isModelDropdownOpen.value) {
    nextTick(() => {
      modelSearchInput.value?.focus();
    });
  }
}

function onModelSearchInput() {
  modelStore.searchLibrary(modelSearch.value);
}

function selectModel(name: string) {
  emit("select", name);
  isModelDropdownOpen.value = false;
  modelSearch.value = "";
}

function selectLibraryModel(name: string) {
  emit("pull", name);
  isModelDropdownOpen.value = false;
  modelSearch.value = "";
}

function closeModelDropdown() {
  isModelDropdownOpen.value = false;
}

// Click outside handling
const handleClickOutside = (event: MouseEvent) => {
  if (
    modelSelectorRef.value &&
    !modelSelectorRef.value.contains(event.target as Node)
  ) {
    closeModelDropdown();
  }
};

onMounted(() => {
  document.addEventListener("mousedown", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleClickOutside);
});
</script>

<template>
  <div class="relative" ref="modelSelectorRef">
    <button
      @click="openModelDropdown"
      class="flex items-center gap-1.5 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-2xl px-2.5 py-1 text-[12px] text-[var(--text)] cursor-pointer hover:bg-[var(--bg-active)] transition-colors flex-shrink-0 whitespace-nowrap"
      :class="
        isModelDropdownOpen
          ? 'bg-[var(--bg-active)] ring-1 ring-[var(--accent)]/30'
          : ''
      "
    >
      <svg
        v-if="isActiveModelPulling"
        class="w-3 h-3 text-[var(--accent)] animate-spin flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" />
      </svg>
      <span class="max-w-[140px] truncate leading-none">{{
        activeModelName
      }}</span>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="ml-0.5 opacity-50 transition-transform"
        :class="isModelDropdownOpen ? 'rotate-180' : ''"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div
      v-if="isModelDropdownOpen"
      class="absolute bottom-full right-0 mb-2 w-80 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl overflow-hidden shadow-[var(--shadow-lg)] z-50 animate-in fade-in zoom-in-95 duration-150 origin-bottom-right"
    >
      <div class="p-2 border-b border-[var(--border)] bg-[var(--bg-base)]">
        <input
          ref="modelSearchInput"
          v-model="modelSearch"
          @input="onModelSearchInput"
          placeholder="Search models..."
          class="w-full bg-[var(--bg-input)] rounded-lg px-3 py-2 text-[13px] text-[var(--text)] border border-transparent focus:border-[var(--accent)]/50 outline-none placeholder-[var(--text-dim)] transition-all"
        />
      </div>

      <div class="max-h-[380px] overflow-y-auto no-scrollbar">
        <!-- INSTALLED MODELS -->
        <template v-if="filteredInstalledModels.length > 0">
          <div
            class="px-3.5 py-2 text-[10px] text-[var(--text-dim)] uppercase tracking-[0.06em] font-[700] bg-[var(--bg-base)]/50 sticky top-0 z-10 backdrop-blur-md"
          >
            Installed Models
          </div>
          <div class="flex flex-col">
            <div
              v-for="m in filteredInstalledModels"
              :key="'installed-' + m.name"
              class="group flex flex-col px-4 py-3 cursor-pointer transition-colors border-b border-[var(--border-subtle)] last:border-b-0"
              :class="
                m.name === activeModelName
                  ? 'bg-[var(--accent-muted)]/10'
                  : 'hover:bg-[var(--bg-hover)]'
              "
              @click="selectModel(m.name)"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 truncate">
                  <span
                    class="truncate text-[13.5px] font-[600]"
                    :class="
                      m.name === activeModelName
                        ? 'text-[var(--accent)]'
                        : 'text-[var(--text)]'
                    "
                  >
                    {{ m.name.replace(/-cloud$/, "") }}
                  </span>
                  <ModelTagBadge v-if="m.name.endsWith('-cloud')" tag="cloud" />
                </div>
                <svg
                  v-if="m.name === activeModelName"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="flex-shrink-0"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div
                class="flex flex-wrap items-center gap-1.5 mt-2 transition-opacity group-hover:opacity-100"
                :class="
                  m.name === activeModelName ? 'opacity-100' : 'opacity-70'
                "
              >
                <ModelTagBadge :tag="modelStore.formatBytes(m.size)" />
                <ModelTagBadge
                  v-if="m.details.parameter_size"
                  :tag="m.details.parameter_size"
                />
                <ModelTagBadge
                  v-if="m.details.quantization_level"
                  :tag="m.details.quantization_level"
                />

                <template v-if="modelStore.capabilities[m.name]">
                  <ModelTagBadge
                    v-if="modelStore.capabilities[m.name].vision"
                    tag="vision"
                  />
                  <ModelTagBadge
                    v-if="modelStore.capabilities[m.name].tools"
                    tag="tools"
                  />
                  <ModelTagBadge
                    v-if="modelStore.capabilities[m.name].thinking"
                    tag="thinking"
                  />
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- LIBRARY MODELS -->
        <template v-if="filteredLibraryModels.length > 0">
          <div
            class="px-3.5 py-2 text-[10px] text-[var(--text-dim)] uppercase tracking-[0.06em] font-[700] bg-[var(--bg-base)]/50 sticky top-0 z-10 backdrop-blur-md flex items-center gap-2"
          >
            <span>From Library</span>
            <div
              v-if="modelStore.isSearching"
              class="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"
            />
          </div>
          <div class="flex flex-col">
            <div
              v-for="lib in filteredLibraryModels"
              :key="'lib-' + lib.name"
              class="flex flex-col px-4 py-3 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-subtle)] last:border-b-0"
              @click="selectLibraryModel(lib.name)"
            >
              <div class="flex items-center justify-between gap-1.5 mb-1.5">
                <span
                  class="truncate font-[600] text-[var(--text)] text-[13.5px]"
                  >{{ lib.name }}</span
                >
                <svg
                  class="w-3.5 h-3.5 text-[var(--text-dim)] opacity-40 group-hover:opacity-100 transition-opacity"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div class="flex flex-wrap items-center gap-1.5 mb-2">
                <ModelTagBadge v-for="tag in lib.tags" :key="tag" :tag="tag" />
              </div>
              <p
                v-if="lib.description"
                class="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed opacity-80"
              >
                {{ lib.description }}
              </p>
            </div>
          </div>
        </template>

        <!-- NO RESULTS -->
        <div
          v-if="
            modelSearch.trim() &&
            filteredInstalledModels.length === 0 &&
            filteredLibraryModels.length === 0 &&
            !modelStore.isSearching
          "
          class="p-8 text-center"
        >
          <p class="text-[13px] text-[var(--text-muted)] mb-4">
            No models found.
          </p>
          <button
            @click="selectLibraryModel(modelSearch.trim())"
            class="px-4 py-2 bg-[var(--text)] text-[var(--bg-base)] rounded-xl text-[12px] font-bold shadow-md hover:scale-[1.03] transition-all"
          >
            Pull "{{ modelSearch.trim() }}"
          </button>
        </div>

        <div
          v-if="!modelSearch.trim() && allModelNames.length === 0"
          class="p-8 text-center text-[12.5px] text-[var(--text-dim)] italic"
        >
          No models installed yet.
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
