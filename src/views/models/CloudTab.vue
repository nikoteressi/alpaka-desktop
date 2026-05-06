<template>
  <div class="flex flex-col gap-4" role="tabpanel">
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
          <path d="M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-11 6.5" />
        </svg>
        <p class="text-[13px] font-semibold text-[var(--text)]">
          Ollama Cloud Models
        </p>
      </div>
      <p class="text-[12px] text-[var(--text-muted)] leading-relaxed">
        Real-time discovery of models supporting Ollama Cloud execution directly
        from the official library.
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
        No cloud models found. Try checking your internet connection.
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
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import ModelCard from "../../components/models/ModelCard.vue";
import CloudTagSelector from "../../components/models/CloudTagSelector.vue";
import { useModelStore } from "../../stores/models";
import { useAppOrchestration } from "../../composables/useAppOrchestration";
import { useModelLibrary } from "../../composables/useModelLibrary";
import type { ModelName } from "../../types/models";

const modelStore = useModelStore();
const orchestration = useAppOrchestration();
const router = useRouter();
const { dynamicCloudModels, isCloudLoading, fetchCloudModels } =
  useModelLibrary();

onMounted(() => {
  if (dynamicCloudModels.value.length === 0) fetchCloudModels();
});

const isTagFetching = ref(false);
const tagSelector = ref({
  show: false,
  modelSlug: "",
  tags: [] as string[],
});

async function openCloudModel(name: string) {
  const slug = name;
  isTagFetching.value = true;
  try {
    const allTags = await modelStore.fetchLibraryTags(slug);
    const cloudTags = allTags.filter((t) => t.toLowerCase().includes("cloud"));
    if (cloudTags.length === 0) {
      const fallback = slug.includes(":") ? slug : `${slug}:cloud`;
      await startChat(fallback);
    } else if (cloudTags.length === 1) {
      await startChat(cloudTags[0]);
    } else {
      tagSelector.value = { show: true, modelSlug: slug, tags: cloudTags };
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
</script>
