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

            <!-- Active Creates — running or errored only; cancelled/done don't appear here -->
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
                    <!-- Dismiss error -->
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
                <!-- Running: pulsing indicator -->
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
                <!-- Error: show message -->
                <p
                  v-else-if="cs.phase === 'error'"
                  class="text-[11px] text-[var(--danger)] leading-snug mt-0.5"
                >
                  {{ cs.error }}
                </p>
              </div>
            </div>

            <Transition name="fade-slide" mode="out-in">
              <!-- Library Section -->
              <div
                v-if="activeTab === 'library'"
                key="library"
                class="flex flex-col gap-8"
                role="tabpanel"
              >
                <LibraryBrowser @select="openLibraryDetails" />
              </div>

              <!-- Local Models Section -->
              <div
                v-else-if="activeTab === 'local'"
                key="local"
                class="flex flex-col gap-2"
                role="tabpanel"
              >
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
                    >Failed to load models: {{ modelStoreErrorMessage }}</span
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
                    >No models installed locally. Go to Library to pull
                    one!</span
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
                        :has-update="modelStore.hasUpdate(model.name as string)"
                        :is-favorite="
                          modelStore.isFavorite(model.name as string)
                        "
                        :on-favorite="
                          () => modelStore.toggleFavorite(model.name as string)
                        "
                        :user-tags="
                          modelStore.getUserTags(model.name as string)
                        "
                        :on-click="() => openLocalModel(model.name as string)"
                        :on-delete="() => confirmDelete(model.name as string)"
                        :on-edit-tags="
                          () => openTagEditor(model.name as string)
                        "
                        :on-action="
                          modelStore.hasUpdate(model.name as string)
                            ? () => modelStore.pullModel(model.name as string)
                            : undefined
                        "
                        :action-label="
                          modelStore.hasUpdate(model.name as string)
                            ? 'Update'
                            : undefined
                        "
                        :action-color="
                          modelStore.hasUpdate(model.name as string)
                            ? '#fbbf24'
                            : undefined
                        "
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

              <!-- Cloud Models Section -->
              <div
                v-else-if="activeTab === 'cloud'"
                key="cloud"
                class="flex flex-col gap-4"
                role="tabpanel"
              >
                <div
                  class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-[14px_18px]"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <svg
                      class="w-3.5 h-3.5 text-[var(--accent)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path
                        d="M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-11 6.5"
                      />
                    </svg>
                    <p class="text-[13px] font-semibold text-[var(--text)]">
                      Ollama Cloud Models
                    </p>
                  </div>
                  <p
                    class="text-[12px] text-[var(--text-muted)] leading-relaxed"
                  >
                    Real-time discovery of models supporting Ollama Cloud
                    execution directly from the official library.
                  </p>
                </div>

                <div class="relative min-h-[400px]">
                  <!-- Loading Overlay for Tag Discovery -->
                  <div
                    v-if="isTagFetching"
                    class="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-base)]/40 backdrop-blur-[2px] rounded-xl"
                  >
                    <div
                      class="flex flex-col items-center gap-3 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-strong)] shadow-2xl animate-in fade-in zoom-in duration-200"
                    >
                      <div
                        class="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"
                      ></div>
                      <p class="text-[13px] font-medium text-[var(--text)]">
                        Resolving cloud versions...
                      </p>
                    </div>
                  </div>

                  <div
                    v-if="isCloudLoading"
                    class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
                  >
                    <div
                      v-for="i in 4"
                      :key="i"
                      class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 h-40 animate-pulse"
                    />
                  </div>
                  <div
                    v-else-if="dynamicCloudModels.length === 0"
                    class="text-[13px] text-[var(--text-dim)] py-12 text-center bg-[var(--bg-input)] border border-dashed border-[var(--border-subtle)] rounded-xl"
                  >
                    No cloud models found. Try checking your internet
                    connection.
                  </div>
                  <div
                    v-else
                    class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
                  >
                    <ModelCard
                      v-for="model in dynamicCloudModels"
                      :key="'cloud-' + model.name"
                      :name="model.name"
                      :tags="['cloud', ...model.tags]"
                      :description="model.description"
                      :pull-count="model.pull_count"
                      :date="model.updated_at"
                      :glow-color="'rgba(56, 189, 248, 0.13)'"
                      action-label="Run"
                      action-color="#38bdf8"
                      :on-action="() => openCloudModel(model.name as string)"
                    />
                  </div>
                </div>
              </div>

              <!-- Hardware Section -->
              <div
                v-else-if="activeTab === 'engine'"
                key="engine"
                class="flex flex-col gap-4"
                role="tabpanel"
              >
                <!-- Hardware Specs -->
                <div
                  class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm"
                >
                  <div class="flex items-center gap-2 mb-4">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="var(--accent)"
                      stroke-width="2.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <h3 class="text-[14px] font-bold text-[var(--text)]">
                      Engine Status & Hardware
                    </h3>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                      class="bg-[var(--bg-base)] p-3 rounded-lg border border-[var(--border-subtle)]"
                    >
                      <p
                        class="text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1"
                      >
                        Graphics (GPU)
                      </p>
                      <p class="text-[13px] text-[var(--text)] font-medium">
                        {{ hardware?.gpu_name ?? "Detecting..." }}
                      </p>
                      <p class="text-[11px] text-[var(--accent)] mt-1">
                        {{
                          hardware?.vram_mb
                            ? (hardware.vram_mb / 1024).toFixed(1) +
                              " GB VRAM Available"
                            : "No VRAM detected"
                        }}
                      </p>
                      <p
                        v-if="settingsStore.chatOptions.num_gpu === 0"
                        class="text-[10px] text-[var(--text-dim)] mt-1"
                      >
                        Offloading: CPU only
                      </p>
                      <p
                        v-else-if="
                          (settingsStore.chatOptions.num_gpu ?? -1) > 0
                        "
                        class="text-[10px] text-[var(--text-dim)] mt-1"
                      >
                        Offloading:
                        {{ settingsStore.chatOptions.num_gpu }} layers
                      </p>
                    </div>
                    <div
                      class="bg-[var(--bg-base)] p-3 rounded-lg border border-[var(--border-subtle)]"
                    >
                      <p
                        class="text-[10px] text-[var(--text-dim)] uppercase font-bold mb-1"
                      >
                        Memory (RAM)
                      </p>
                      <p class="text-[13px] text-[var(--text)] font-medium">
                        {{
                          hardware?.ram_mb
                            ? (hardware.ram_mb / 1024).toFixed(0) +
                              " GB System RAM"
                            : "Detecting..."
                        }}
                      </p>
                      <p class="text-[11px] text-[var(--text-muted)] mt-1">
                        Shared with OS and other apps
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Suggestions -->
                <div class="flex flex-col gap-3">
                  <p
                    class="text-[11px] text-[var(--text-dim)] font-bold uppercase tracking-wider px-1"
                  >
                    Recommended for Your Machine
                  </p>
                  <div
                    class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4"
                  >
                    <ModelCard
                      v-for="rec in recommendedModels"
                      :key="'rec-' + rec.name"
                      :name="rec.displayName"
                      :tags="[rec.params]"
                      :file-size="rec.sizeGb.toFixed(1) + ' GB'"
                      :is-installed="modelStore.isInstalled(rec.name)"
                      :action-label="
                        modelStore.isInstalled(rec.name) ? 'Details' : 'Pull'
                      "
                      :on-action="
                        () =>
                          modelStore.isInstalled(rec.name)
                            ? openLibraryDetailsByName(rec.name)
                            : doPullModel(rec.name)
                      "
                    />
                  </div>
                </div>
              </div>
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

    <!-- Cloud Tag Selector Modal -->
    <CloudTagSelector
      :is-open="tagSelector.show"
      :model-name="tagSelector.modelSlug"
      :tags="tagSelector.tags"
      @select="onCloudTagSelected"
      @close="tagSelector.show = false"
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
import { useRouter } from "vue-router";
import AppTabs from "../components/shared/AppTabs.vue";
import CustomTooltip from "../components/shared/CustomTooltip.vue";
import ConfirmationModal from "../components/shared/ConfirmationModal.vue";
import ModelCard from "../components/models/ModelCard.vue";
import LibraryModelDetails from "../components/models/LibraryModelDetails.vue";
import LocalModelDetails from "../components/models/LocalModelDetails.vue";
import LibraryBrowser from "../components/models/LibraryBrowser.vue";
import CloudTagSelector from "../components/models/CloudTagSelector.vue";
import CreateModelPage from "../components/models/CreateModelPage.vue";
import { useModelStore, modelMatchesTag } from "../stores/models";
import { useSettingsStore } from "../stores/settings";
import { invoke } from "@tauri-apps/api/core";
import { useAppOrchestration } from "../composables/useAppOrchestration";
import { useConfirmationModal } from "../composables/useConfirmationModal";
import { useModelLibrary } from "../composables/useModelLibrary";
import type { ModelName, LibraryModel, Model } from "../types/models";
import { storeToRefs } from "pinia";
import { LIBRARY_SIZES } from "../lib/constants";
import {
  IconLibrary,
  IconLocal,
  IconCloud,
  IconEngine,
} from "../components/shared/icons";

const modelStore = useModelStore();
const { selectedModel } = storeToRefs(modelStore);
const settingsStore = useSettingsStore();

const selectedLocalModel = ref<Model | null>(null);

const createModelMode = ref<{
  name: string;
  modelfile: string;
} | null>(null);

const modelStoreErrorMessage = computed(() => modelStore.error ?? "");

// Only show running and errored creates in the active-creates bar.
// Cancelled and done are handled on the CreateModelPage itself.
const activeCreates = computed(() =>
  Object.values(modelStore.creating).filter(
    (cs) => cs.phase === "running" || cs.phase === "error",
  ),
);
const orchestration = useAppOrchestration();
const router = useRouter();
const { modal, openModal, onConfirm, onCancel } = useConfirmationModal();

const activeTab = ref("local");
const activeTagFilter = ref<string | null>(null);
const editingTagsFor = ref<string | null>(null);
const tagInputValue = ref("");
const {
  dynamicCloudModels,
  isCloudLoading,
  hardware,
  fetchCloudModels,
  detectHardware,
  cancelSearch,
} = useModelLibrary();

// ---- Filtered & sorted local models ----
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

// ---- Tag editor ----
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

interface Tab {
  id: string;
  name: string;
  icon?: Component;
}

const tabs: Tab[] = [
  { id: "local", name: "Pulled", icon: IconLocal },
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
    // Fall through with empty modelfile — user can write from scratch
  }
  selectedLocalModel.value = null;
  createModelMode.value = { name, modelfile };
}

// Subpage details
function openLibraryDetails(model: LibraryModel) {
  modelStore.selectedModel = model;
  modelStore.fetchLibraryModelDetails(model.slug);
  modelStore.fetchLibraryTagsDetailed(model.slug);
}

function openLibraryDetailsByName(name: string) {
  const slug = name.split(":")[0];
  // We don't have the full LibraryModel object from just a name,
  // so we create a placeholder and fetch details
  const placeholder: LibraryModel = {
    name: slug,
    slug: slug,
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

function getActiveCaps(name: string) {
  const caps = modelStore.capabilities[name];
  if (!caps) return [];
  const tags: string[] = [];
  if (caps.vision) tags.push("vision");
  if (caps.tools) tags.push("tools");
  if (caps.thinking) tags.push("thinking");
  return tags;
}

const tagSelector = ref({
  show: false,
  modelSlug: "",
  tags: [] as string[],
});

const isTagFetching = ref(false);

async function openCloudModel(name: string) {
  const slug = name;
  isTagFetching.value = true;

  try {
    const allTags = await modelStore.fetchLibraryTags(slug);
    const cloudTags = allTags.filter((t) => t.toLowerCase().includes("cloud"));

    if (cloudTags.length === 0) {
      const fallback = slug.includes(":") ? slug : `${slug}:cloud`;
      startChat(fallback);
    } else if (cloudTags.length === 1) {
      startChat(cloudTags[0]);
    } else {
      tagSelector.value = {
        show: true,
        modelSlug: slug,
        tags: cloudTags,
      };
    }
  } finally {
    isTagFetching.value = false;
  }
}

async function onCloudTagSelected(fullTagName: string) {
  tagSelector.value.show = false;
  await startChat(fullTagName);
}

async function startChat(fullName: string) {
  modelStore.addCloudModel(fullName);
  orchestration.startNewChat(fullName as ModelName);
  router.push("/chat");
}

// Fetch cloud models when user switches to cloud tab
watch(activeTab, (newTab) => {
  if (newTab === "cloud" && dynamicCloudModels.value.length === 0) {
    fetchCloudModels();
  }
});

function calcAvailGb(hw: typeof hardware.value): number {
  if (hw?.vram_mb) return (hw.vram_mb / 1024) * 0.9;
  if (hw?.ram_mb) return (hw.ram_mb / 1024) * 0.6;
  return 0;
}

const recommendedModels = computed(() => {
  const avail = calcAvailGb(hardware.value);
  if (avail === 0) return [];

  return Object.entries(LIBRARY_SIZES)
    .filter(([, size]) => size <= avail)
    .map(([name, size]) => ({
      name,
      displayName: name.split(":")[0],
      params: name.split(":")[1] ?? "8B",
      sizeGb: size,
    }))
    .sort((a, b) => b.sizeGb - a.sizeGb)
    .slice(0, 4);
});

// ---- Helpers ----
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
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-subpage-enter-from {
  opacity: 0;
  transform: scale(0.98) translateY(10px);
}
.fade-subpage-leave-to {
  opacity: 0;
  transform: scale(1.02) translateY(-10px);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
