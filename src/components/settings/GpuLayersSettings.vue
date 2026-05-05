<template>
  <div class="settings-card gap-3">
    <div>
      <p class="text-[13.5px] font-bold text-[var(--text)]">GPU Layers</p>
      <p class="text-[12px] text-[var(--text-dim)] mt-0.5">
        Number of model layers to offload to the GPU.
        <span class="font-mono">-1</span> = all layers (auto),
        <span class="font-mono">0</span> = CPU only.
      </p>
    </div>

    <!-- Hardware summary -->
    <div
      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[11.5px]"
    >
      <span v-if="hardware?.gpu_name" class="text-[var(--text)] font-medium">
        {{ hardware.gpu_name }}
      </span>
      <span v-else class="text-[var(--text-dim)]">No GPU detected</span>

      <span v-if="hardware?.vram_mb" class="text-[var(--accent)]">
        · {{ (hardware.vram_mb / 1024).toFixed(1) }} GB VRAM
      </span>
    </div>

    <!-- Input row -->
    <div class="flex items-center gap-3">
      <input
        type="number"
        :value="settingsStore.chatOptions.num_gpu ?? -1"
        min="-1"
        max="999"
        step="1"
        @change="onNumGpuChange"
        class="w-28 bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 text-[12px] outline-none transition-colors font-mono"
      />
      <span class="text-[12px] text-[var(--text-dim)]">{{ layerLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../../stores/settings";
import type { HardwareInfo } from "../../types/models";

const settingsStore = useSettingsStore();
const hardware = ref<HardwareInfo | null>(null);

const layerLabel = computed(() => {
  const v = settingsStore.chatOptions.num_gpu ?? -1;
  if (v === -1) return "All layers (auto)";
  if (v === 0) return "CPU only — no GPU offloading";
  return `${v} layers on GPU`;
});

function onNumGpuChange(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  const parsed = Number.parseInt(raw, 10);
  const clamped = Number.isNaN(parsed)
    ? -1
    : Math.max(-1, Math.min(999, parsed));
  settingsStore.updateChatOptions({ num_gpu: clamped });
}

onMounted(async () => {
  try {
    hardware.value = await invoke<HardwareInfo>("detect_hardware");
  } catch (e) {
    console.warn("Hardware detection failed:", e);
  }
});
</script>

<style scoped>
.settings-card {
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
}
</style>
