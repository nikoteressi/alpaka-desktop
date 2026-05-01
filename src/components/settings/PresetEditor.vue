<template>
  <div class="settings-card gap-3">
    <p class="text-[13.5px] font-bold text-[var(--text)]">Presets</p>

    <div class="max-h-[220px] overflow-y-auto flex flex-col gap-1 pr-0.5">
      <div
        v-for="preset in settingsStore.presets"
        :key="preset.id"
        @click="selectPreviewPreset(preset.id)"
        class="flex items-center justify-between px-3 py-2 rounded-xl border transition-all cursor-pointer select-none"
        :class="
          previewPresetId === preset.id
            ? 'bg-[var(--accent-muted)] border-[var(--accent)]'
            : 'bg-[var(--bg-elevated)] border-[var(--border)] hover:border-[var(--border-strong)]'
        "
      >
        <div class="flex items-center gap-2">
          <span
            class="text-[12.5px] font-semibold"
            :class="
              previewPresetId === preset.id
                ? 'text-[var(--accent)]'
                : 'text-[var(--text)]'
            "
            >{{ preset.name }}</span
          >
          <span
            v-if="settingsStore.defaultPresetId === preset.id"
            class="text-[10px] px-1.5 py-0.5 bg-[var(--accent)] text-white rounded-full font-bold leading-none"
            >Default</span
          >
        </div>
        <CustomTooltip text="Delete preset" wrapper-class="inline-block">
          <button
            v-if="!preset.isBuiltin"
            @click.stop="confirmDeletePreset(preset.id, preset.name)"
            class="text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors cursor-pointer text-[13px] leading-none"
          >
            ×
          </button>
        </CustomTooltip>
      </div>
    </div>

    <div
      class="flex flex-col gap-4 pt-3 border-t border-[var(--border-subtle)]"
    >
      <MirostatSelector
        :model-value="localMirostat"
        compact
        @update:model-value="updateLocalMirostat"
      />

      <SettingsSlider
        label="Temperature"
        :model-value="localOptions.temperature"
        @update:model-value="updateLocalOption('temperature', $event)"
        :min="0"
        :max="1"
        :step="0.1"
        compact
      />
      <SettingsSlider
        v-if="localMirostat === 0"
        label="Top P"
        :model-value="localOptions.top_p"
        @update:model-value="updateLocalOption('top_p', $event)"
        :min="0"
        :max="1"
        :step="0.05"
        compact
      />
      <SettingsSlider
        v-if="localMirostat === 0"
        label="Top K"
        :model-value="localOptions.top_k"
        @update:model-value="updateLocalOption('top_k', $event)"
        :min="0"
        :max="100"
        :step="1"
        compact
      />
      <SettingsSlider
        v-if="localMirostat !== 0"
        label="Mirostat Tau"
        :model-value="localOptions.mirostat_tau ?? 5"
        @update:model-value="updateLocalOption('mirostat_tau', $event)"
        :min="0.1"
        :max="10"
        :step="0.1"
        compact
      />
      <SettingsSlider
        v-if="localMirostat !== 0"
        label="Mirostat Eta"
        :model-value="localOptions.mirostat_eta ?? 0.1"
        @update:model-value="updateLocalOption('mirostat_eta', $event)"
        :min="0.01"
        :max="1"
        :step="0.01"
        compact
      />
      <SettingsSlider
        label="Repeat Penalty"
        :model-value="localOptions.repeat_penalty"
        @update:model-value="updateLocalOption('repeat_penalty', $event)"
        :min="1"
        :max="2"
        :step="0.05"
        compact
      />
      <SettingsSlider
        label="Repeat Last N"
        :model-value="localOptions.repeat_last_n"
        @update:model-value="updateLocalOption('repeat_last_n', $event)"
        :min="0"
        :max="128"
        :step="8"
        compact
      />
    </div>

    <div
      class="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]"
    >
      <button
        v-if="
          previewPresetId && settingsStore.defaultPresetId !== previewPresetId
        "
        @click="settingsStore.updateDefaultPreset(previewPresetId)"
        class="text-[11px] text-[var(--accent)] font-bold hover:underline cursor-pointer"
      >
        Set as Default
      </button>
      <div v-else class="flex-1" />

      <div v-if="savingPreset" class="flex gap-1.5 items-center">
        <input
          v-model="newPresetName"
          @keydown.enter="commitSavePreset"
          @keydown.escape="cancelSavePreset"
          placeholder="Preset name"
          maxlength="32"
          class="custom-input w-32"
          ref="presetNameInput"
        />
        <button
          @click="commitSavePreset"
          :disabled="!newPresetName.trim()"
          class="px-2 py-1 bg-[var(--accent)] text-white text-[10px] font-bold rounded-lg cursor-pointer disabled:opacity-40"
        >
          Save
        </button>
        <button
          @click="cancelSavePreset"
          class="px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[var(--text)] text-[10px] rounded-lg cursor-pointer"
        >
          ×
        </button>
      </div>
      <button
        v-else
        @click="startSavingPreset"
        class="text-[11px] text-[var(--accent)] font-bold hover:underline cursor-pointer"
      >
        + Save as preset
      </button>
    </div>

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
import { ref, computed, watch, nextTick } from "vue";
import CustomTooltip from "../shared/CustomTooltip.vue";
import SettingsSlider from "./SettingsSlider.vue";
import MirostatSelector from "../shared/MirostatSelector.vue";
import ConfirmationModal from "../shared/ConfirmationModal.vue";
import { useSettingsStore } from "../../stores/settings";
import { useConfirmationModal } from "../../composables/useConfirmationModal";
import type { PresetOptions } from "../../types/settings";

const settingsStore = useSettingsStore();
const { modal, openModal, onConfirm, onCancel } = useConfirmationModal();

const previewPresetId = ref<string>(settingsStore.defaultPresetId);

const localOptions = ref<PresetOptions>(
  (() => {
    const preset = settingsStore.presets.find(
      (p) => p.id === settingsStore.defaultPresetId,
    );
    return (
      preset?.options ?? {
        temperature: settingsStore.chatOptions.temperature,
        top_p: settingsStore.chatOptions.top_p,
        top_k: settingsStore.chatOptions.top_k,
        num_ctx: settingsStore.chatOptions.num_ctx,
        repeat_penalty: settingsStore.chatOptions.repeat_penalty,
        repeat_last_n: settingsStore.chatOptions.repeat_last_n,
        mirostat: settingsStore.chatOptions.mirostat,
        mirostat_tau: settingsStore.chatOptions.mirostat_tau,
        mirostat_eta: settingsStore.chatOptions.mirostat_eta,
      }
    );
  })(),
);

watch(
  () => settingsStore.chatOptions,
  (newOpts) => {
    if (!previewPresetId.value) {
      localOptions.value = {
        temperature: newOpts.temperature,
        top_p: newOpts.top_p,
        top_k: newOpts.top_k,
        num_ctx: newOpts.num_ctx,
        repeat_penalty: newOpts.repeat_penalty,
        repeat_last_n: newOpts.repeat_last_n,
        mirostat: newOpts.mirostat,
        mirostat_tau: newOpts.mirostat_tau,
        mirostat_eta: newOpts.mirostat_eta,
      };
    }
  },
  { deep: true },
);

function selectPreviewPreset(id: string) {
  previewPresetId.value = id;
  const preset = settingsStore.presets.find((p) => p.id === id);
  if (preset) localOptions.value = { ...preset.options };
}

function updateLocalOption(key: keyof PresetOptions, value: number) {
  previewPresetId.value = "";
  localOptions.value = { ...localOptions.value, [key]: value };
}

const localMirostat = computed(() => localOptions.value.mirostat ?? 0);

function updateLocalMirostat(value: 0 | 1 | 2) {
  previewPresetId.value = "";
  localOptions.value = { ...localOptions.value, mirostat: value };
}

const savingPreset = ref(false);
const newPresetName = ref("");
const presetNameInput = ref<HTMLInputElement | null>(null);

async function startSavingPreset() {
  savingPreset.value = true;
  newPresetName.value = "";
  await nextTick();
  presetNameInput.value?.focus();
}

async function commitSavePreset() {
  if (!newPresetName.value.trim()) return;
  await settingsStore.saveAsPreset(newPresetName.value, localOptions.value);
  cancelSavePreset();
}

function cancelSavePreset() {
  savingPreset.value = false;
  newPresetName.value = "";
}

function confirmDeletePreset(id: string, name: string) {
  openModal({
    title: "Delete Preset",
    message: `Delete the "${name}" preset? This cannot be undone.`,
    confirmLabel: "Delete",
    kind: "danger",
    onConfirm: () => settingsStore.deletePreset(id),
  });
}
</script>
