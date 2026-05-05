<template>
  <div class="flex flex-col gap-4" role="tabpanel">
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
                ? (hardware.vram_mb / 1024).toFixed(1) + " GB VRAM Available"
                : "No VRAM detected"
            }}
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
                ? (hardware.ram_mb / 1024).toFixed(0) + " GB System RAM"
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
      <div class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        <ModelCard
          v-for="rec in recommendedModels"
          :key="'rec-' + rec.name"
          :name="rec.displayName"
          :tags="[rec.params]"
          :file-size="rec.sizeGb.toFixed(1) + ' GB'"
          :is-installed="modelStore.isInstalled(rec.name)"
          :action-label="modelStore.isInstalled(rec.name) ? 'Details' : 'Pull'"
          :on-action="() => onAction(rec.name)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import ModelCard from "../../components/models/ModelCard.vue";
import { useModelStore } from "../../stores/models";
import { useModelLibrary } from "../../composables/useModelLibrary";
import { LIBRARY_SIZES } from "../../lib/constants";
import type { ModelName } from "../../types/models";

const emit = defineEmits<{
  (e: "pull-model", name: string): void;
  (e: "open-library-details", name: string): void;
}>();

const modelStore = useModelStore();
const { hardware, detectHardware } = useModelLibrary();

onMounted(() => {
  detectHardware();
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

function onAction(name: string) {
  if (modelStore.isInstalled(name)) {
    emit("open-library-details", name);
  } else {
    emit("pull-model", name as ModelName);
  }
}
</script>
