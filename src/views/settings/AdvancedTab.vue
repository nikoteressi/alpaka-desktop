<template>
  <div class="flex flex-col gap-[8px]">
    <div class="settings-card">
      <div>
        <p class="text-[13.5px] font-bold text-[var(--text)]">Stop Sequences</p>
        <p class="text-[12px] text-[var(--text-dim)] mt-0.5">
          Custom tokens that end generation early. Up to 4 sequences.
        </p>
      </div>
      <div class="mt-3">
        <StopSequencesInput
          :model-value="settingsStore.chatOptions.stop ?? []"
          @update:model-value="
            settingsStore.updateChatOptions({
              stop: $event.length ? $event : undefined,
            })
          "
        />
      </div>
    </div>

    <!-- Seed -->
    <div class="settings-card gap-3">
      <div>
        <p class="text-[13.5px] font-bold text-[var(--text)]">Seed</p>
        <p class="text-[12px] text-[var(--text-dim)] mt-0.5">
          Fixed integer for reproducible generation. Leave empty for random
          output.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <input
          type="number"
          :value="settingsStore.chatOptions.seed ?? ''"
          @change="
            (() => {
              const v = ($event.target as HTMLInputElement).value;
              const n = parseInt(v, 10);
              settingsStore.updateChatOptions({
                seed: v === '' || Number.isNaN(n) ? undefined : n,
              });
            })()
          "
          placeholder="empty = random"
          class="w-40 bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 text-[12px] outline-none transition-colors"
          :class="
            settingsStore.chatOptions.seed !== undefined
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : ''
          "
        />
        <button
          v-if="settingsStore.chatOptions.seed !== undefined"
          @click="settingsStore.updateChatOptions({ seed: undefined })"
          class="text-[11px] px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors cursor-pointer"
        >
          Reset to random
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StopSequencesInput from "../../components/settings/StopSequencesInput.vue";
import { useSettingsStore } from "../../stores/settings";

const settingsStore = useSettingsStore();
</script>
