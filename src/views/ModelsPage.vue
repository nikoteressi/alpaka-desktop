<template>
  <div
    class="h-full overflow-y-auto bg-[var(--bg-base)] px-6 py-5 no-scrollbar"
  >
    <div class="max-w-[900px] mx-auto">
      <!-- Detail Sub-page Transition -->
      <Transition name="fade-subpage" mode="out-in">
        <div v-if="selectedModel" class="flex flex-col h-full">
          <!-- Breadcrumb / Back Navigation -->
          <div
            class="flex items-center gap-2.5 mb-5 animate-in fade-in slide-in-from-left-2 duration-300"
          >
            <button
              @click="closeDetails"
              class="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] transition-all py-1 px-2 rounded-md hover:bg-[var(--bg-hover)]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Library</span>
            </button>
            <span class="text-[var(--text-dim)] text-[12px] opacity-60">/</span>
            <span class="text-[13px] text-[var(--text)] font-semibold">{{
              selectedModel.name
            }}</span>
          </div>

          <LibraryModelDetails
            :model="selectedModel"
            :tags="modelStore.selectedModelTags"
            :is-loading="modelStore.isLoadingDetails"
            @pull="doPullModel"
          />
        </div>

        <div v-else-if="selectedLocalModel" class="flex flex-col h-full">
          <LocalModelDetails
            :model="selectedLocalModel"
            @back="selectedLocalModel = null"
            @edit-modelfile="openEditModelfile"
          />
        </div>

        <div
          v-else-if="createModelMode"
          key="create"
          class="flex flex-col h-full"
        >
          <CreateModelPage
            :initial-name="createModelMode.name"
            :initial-modelfile="createModelMode.modelfile"
            @back="createModelMode = null"
            @view-model="
              (name: string) => {
                createModelMode = null;
                openLocalModel(name);
              }
            "
          />
        </div>

        <div v-else class="flex flex-col h-full">
          <!-- Header row -->
          <div class="flex items-center justify-between mb-1">
            <h1 class="text-[17px] font-semibold text-[var(--text)]">
              Models Management
            </h1>
            <button
              @click="createModelMode = { name: '', modelfile: '' }"
              class="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent)] border border-[var(--accent-border)] px-3 py-1.5 rounded-lg hover:bg-[var(--accent-muted)] transition-colors"
            >
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create model
            </button>
          </div>

          <!-- Glassy Horizontal Tabs -->
          <AppTabs
            v-model="activeTab"
            :tabs="tabs"
            aria-label="Models categories"
          />

          <div class="flex flex-col gap-4">
            <!-- Global Active Pulls -->
            <div
              v-if="Object.keys(modelStore.pulling).length > 0"
              class="flex flex-col gap-2 mb-2"
            >
              <p
                class="text-[11px] text-[var(--accent)] font-bold uppercase tracking-wider px-1"
              >
                Active Downloads
              </p>
              <div
                v-for="(prog, modelName) in modelStore.pulling"
                :key="'pulling-' + modelName"
                class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-[10px_14px]"
              >
                <div class="flex items-center justify-between mb-1.5">
                  <span
                    class="text-[13px] text-[var(--text)] font-medium truncate"
                    >{{ modelName }}</span
                  >
                  <span
                    class="text-[12px] text-[var(--text-muted)] ml-2 flex-shrink-0"
                    >{{ prog.status }}</span
                  >
                </div>
                <div
                  class="h-1 bg-[var(--bg-base)] rounded-sm overflow-hidden border border-white/5"
                >
                  <div
                    class="bg-[#4a80d0] h-1 rounded-sm transition-all shadow-[0_0_8px_rgba(74,128,208,0.5)]"
                    :style="{ width: prog.percent + '%' }"
                  />
                </div>
              </div>
            </div>

            <!-- Active Creates — running or errored only -->
            <div
              v-if="activeCreates.length > 0"
              class="flex flex-col gap-2 mb-2"
            >
              <p
                class="text-[11px] text-[var(--accent)] font-bold uppercase tracking-wider px-1"
              >
                Active Creates
              </p>
              <div
                v-for="cs in activeCreates"
                :key="'creating-' + cs.name"
                class="bg-[var(--bg-surface)] border rounded-xl p-[10px_14px] transition-colors"
                :class="
                  cs.phase === 'error'
                    ? 'border-[var(--danger)]/40'
                    : 'border-[var(--border)] cursor-pointer hover:border-[var(--accent)]'
                "
                @click="
                  cs.phase !== 'error' &&
                  (createModelMode = {
                    name: cs.name,
                    modelfile: cs.modelfile,
                  })
                "
              >
                <div class="flex items-center justify-between mb-1">
                  <span
                    class="text-[13px] text-[var(--text)] font-medium truncate"
                    >{{ cs.name }}</span
                  >
                  <div class="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span class="text-[12px] text-[var(--text-muted)]">{{
                      cs.status
                    }}</span>
                    <CustomTooltip text="Dismiss" wrapper-class="inline-flex">
                      <button
                        v-if="cs.phase === 'error'"
                        @click.stop="modelStore.clearCreateState(cs.name)"
                        class="w-4 h-4 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        >
                          <path d="M1 1l10 10M11 1L1 11" />
                        </svg>
                      </button>
                    </CustomTooltip>
                  </div>
                </div>
                <div
                  v-if="cs.phase === 'running'"
                  class="flex items-center gap-1.5"
                >
                  <div
                    class="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse flex-shrink-0"
                  />
                  <span class="text-[11px] text-[var(--text-dim)]"
                    >Creating…</span
                  >
                </div>
                <p
                  v-else-if="cs.phase === 'error'"
                  class="text-[11px] text-[var(--danger)] leading-snug mt-0.5"
                >
                  {{ cs.error }}
                </p>
              </div>
            </div>

            <Transition name="fade-slide" mode="out-in">
              <LibraryTab
                v-if="activeTab === 'library'"
                key="library"
                @select="openLibraryDetails"
              />
              <LocalModelsTab
                v-else-if="activeTab === 'local'"
                key="local"
                @open-model="openLocalModel"
                @delete-model="confirmDelete"
              />
              <MineTab
                v-else-if="activeTab === 'mine'"
                key="mine"
                @open-model="openLocalModel"
                @delete-model="confirmDelete"
              />
              <CloudTab v-else-if="activeTab === 'cloud'" key="cloud" />
              <EngineTab
                v-else-if="activeTab === 'engine'"
                key="engine"
                @pull-model="doPullModel"
                @open-library-details="openLibraryDetailsByName"
              />
            </Transition>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :show="modal.show"
      :title="modal.title"
      :message="modal.message"
      :confirm-label="modal.confirmLabel"
      :kind="modal.kind"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  type Component,
} from "vue";

import AppTabs from "../components/shared/AppTabs.vue";
import CustomTooltip from "../components/shared/CustomTooltip.vue";
import ConfirmationModal from "../components/shared/ConfirmationModal.vue";
import LibraryModelDetails from "../components/models/LibraryModelDetails.vue";
import LocalModelDetails from "../components/models/LocalModelDetails.vue";
import CreateModelPage from "../components/models/CreateModelPage.vue";
import LocalModelsTab from "./models/LocalModelsTab.vue";
import LibraryTab from "./models/LibraryTab.vue";
import CloudTab from "./models/CloudTab.vue";
import EngineTab from "./models/EngineTab.vue";
import MineTab from "./models/MineTab.vue";
import { useModelStore } from "../stores/models";
import { invoke } from "@tauri-apps/api/core";
import { useConfirmationModal } from "../composables/useConfirmationModal";
import { useModelLibrary } from "../composables/useModelLibrary";
import type { ModelName, LibraryModel, Model } from "../types/models";
import { storeToRefs } from "pinia";
import {
  IconLibrary,
  IconLocal,
  IconCloud,
  IconEngine,
  IconMine,
} from "../components/shared/icons";

const modelStore = useModelStore();
const { selectedModel } = storeToRefs(modelStore);

const selectedLocalModel = ref<Model | null>(null);
const createModelMode = ref<{ name: string; modelfile: string } | null>(null);

const activeCreates = computed(() =>
  Object.values(modelStore.creating).filter(
    (cs) => cs.phase === "running" || cs.phase === "error",
  ),
);

const { modal, openModal, onConfirm, onCancel } = useConfirmationModal();
const { fetchCloudModels, detectHardware, cancelSearch } = useModelLibrary();

const activeTab = ref("local");

interface Tab {
  id: string;
  name: string;
  icon?: Component;
}

const tabs: Tab[] = [
  { id: "local", name: "Pulled", icon: IconLocal },
  { id: "mine", name: "Mine", icon: IconMine },
  { id: "library", name: "Library", icon: IconLibrary },
  { id: "cloud", name: "Cloud", icon: IconCloud },
  { id: "engine", name: "Engine", icon: IconEngine },
];

async function doPullModel(name: string) {
  await modelStore.pullModel(name as ModelName);
  activeTab.value = "library";
}

function confirmDelete(name: string) {
  openModal({
    title: "Confirm Delete",
    message: `Remove model '${name}' from local storage?`,
    confirmLabel: "Delete",
    kind: "danger",
    onConfirm: async () => {
      await modelStore.deleteModel(name as ModelName);
    },
  });
}

function openLocalModel(name: string) {
  const model = modelStore.models.find((m) => m.name === name);
  if (model) selectedLocalModel.value = model;
}

async function openEditModelfile(name: string) {
  let modelfile = "";
  try {
    modelfile = await invoke<string>("get_modelfile", { name });
  } catch (e) {
    console.error("Failed to fetch modelfile for", name, e);
  }
  selectedLocalModel.value = null;
  createModelMode.value = { name, modelfile };
}

function openLibraryDetails(model: LibraryModel) {
  modelStore.selectedModel = model;
  modelStore.fetchLibraryModelDetails(model.slug);
  modelStore.fetchLibraryTagsDetailed(model.slug);
}

function openLibraryDetailsByName(name: string) {
  const slug = name.split(":")[0];
  const placeholder: LibraryModel = {
    name: slug,
    slug,
    description: "",
    tags: [],
    pull_count: "",
    updated_at: "",
  };
  openLibraryDetails(placeholder);
}

function closeDetails() {
  modelStore.selectedModel = null;
  modelStore.selectedModelTags = [];
}

// Fetch cloud models when user switches to cloud tab
watch(activeTab, (newTab) => {
  if (newTab === "cloud") {
    fetchCloudModels();
  }
});

onMounted(async () => {
  await modelStore.fetchModels();
  modelStore.initListeners();
  await detectHardware();
});

onUnmounted(() => {
  cancelSearch();
});
</script>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.fade-subpage-enter-active,
.fade-subpage-leave-active {
  transition: all 0.25s ease;
}
.fade-subpage-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.fade-subpage-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
