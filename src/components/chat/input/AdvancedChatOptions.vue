<template>
  <div
    class="p-4 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl shadow-xl w-72 flex flex-col gap-4"
  >
    <div
      class="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-1"
    >
      <span
        class="text-[12px] font-bold text-[var(--text)] uppercase tracking-wider"
        >Advanced Options</span
      >
      <button
        @click="$emit('reset')"
        class="text-[10px] text-[var(--accent)] font-bold hover:underline cursor-pointer"
      >
        Reset to Default
      </button>
    </div>

    <div class="flex flex-col gap-2">
      <div class="relative" ref="presetDropdownRef">
        <button
          @click="isPresetOpen = !isPresetOpen"
          class="w-full flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] rounded-lg px-2 py-1.5 text-[11px] cursor-pointer hover:border-[var(--accent)] transition-colors"
          :class="isPresetOpen ? 'border-[var(--accent)]' : ''"
        >
          <span>{{ currentPresetLabel }}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            class="transition-transform flex-shrink-0"
            :class="isPresetOpen ? 'rotate-180' : ''"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div
          v-if="isPresetOpen"
          class="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-lg shadow-xl z-50 max-h-[240px] overflow-y-auto"
        >
          <button
            @click="selectPreset('')"
            class="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            :class="
              !presetId
                ? 'text-[var(--accent)] font-semibold'
                : 'text-[var(--text)]'
            "
          >
            Custom
          </button>
          <button
            v-for="preset in settingsStore.presets"
            :key="preset.id"
            @click="selectPreset(preset.id)"
            class="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
            :class="
              presetId === preset.id
                ? 'text-[var(--accent)] font-semibold'
                : 'text-[var(--text)]'
            "
          >
            {{ preset.name }}
          </button>
        </div>
      </div>

      <!-- Preset name input (shown while naming a new preset) -->
      <div v-if="saving" class="flex gap-1.5 items-center">
        <input
          v-model="saveName"
          @keydown.enter="commitSave"
          @keydown.escape="() => (saving = false)"
          placeholder="Preset name"
          maxlength="32"
          class="flex-1 min-w-0 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[var(--accent)]"
          ref="saveInput"
        />
        <button
          @click="commitSave"
          :disabled="!saveName.trim()"
          class="px-2 py-1 bg-[var(--accent)] text-white text-[10px] font-bold rounded-lg cursor-pointer disabled:opacity-40"
        >
          Save
        </button>
        <button
          @click="() => (saving = false)"
          class="px-2 py-1 bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[var(--text)] text-[10px] rounded-lg cursor-pointer"
        >
          ✕
        </button>
      </div>

      <!-- Action row (shown when not naming a preset) -->
      <div
        v-else
        class="flex items-center"
        :class="props.model ? 'justify-between' : 'justify-start'"
      >
        <button
          @click="startSave"
          class="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)] rounded-md px-2 py-1 transition-colors cursor-pointer"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Save as preset
        </button>

        <button
          v-if="props.model"
          @click="handleSaveAsModelDefault"
          :disabled="savingDefault"
          class="flex items-center gap-1 text-[10px] border rounded-md px-2 py-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          :class="
            saveDefaultError
              ? 'text-red-400 border-red-500/30 bg-red-500/5'
              : savedAsDefault
                ? 'text-[var(--accent)] border-[var(--accent)]/30 bg-[var(--accent)]/5 font-semibold'
                : 'text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--border-strong)]'
          "
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <path
              d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"
            />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {{
            savingDefault
              ? "Saving…"
              : saveDefaultError
                ? "Failed ✕"
                : savedAsDefault
                  ? "Saved ✓"
                  : "Set as default"
          }}
        </button>
      </div>
    </div>

    <div
      class="border-t border-[var(--border-subtle)] pt-2 flex flex-col gap-4"
    >
      <MirostatSelector
        :model-value="effectiveMirostat"
        compact
        @update:model-value="updateMirostat"
      />

      <SettingsSlider
        label="Temperature"
        :model-value="
          modelValue.temperature ?? settingsStore.chatOptions.temperature
        "
        @update:model-value="updateOption('temperature', $event)"
        :min="0"
        :max="1"
        :step="0.1"
        compact
      />

      <SettingsSlider
        v-if="effectiveMirostat === 0"
        label="Top P"
        :model-value="modelValue.top_p ?? settingsStore.chatOptions.top_p"
        @update:model-value="updateOption('top_p', $event)"
        :min="0"
        :max="1"
        :step="0.05"
        compact
      />

      <SettingsSlider
        v-if="effectiveMirostat === 0"
        label="Top K"
        :model-value="modelValue.top_k ?? settingsStore.chatOptions.top_k"
        @update:model-value="updateOption('top_k', $event)"
        :min="0"
        :max="500"
        :step="1"
        compact
      />

      <SettingsSlider
        v-if="effectiveMirostat !== 0"
        label="Mirostat Tau"
        :model-value="
          modelValue.mirostat_tau ?? settingsStore.chatOptions.mirostat_tau ?? 5
        "
        @update:model-value="updateOption('mirostat_tau', $event)"
        :min="0.1"
        :max="10"
        :step="0.1"
        compact
      />

      <SettingsSlider
        v-if="effectiveMirostat !== 0"
        label="Mirostat Eta"
        :model-value="
          modelValue.mirostat_eta ??
          settingsStore.chatOptions.mirostat_eta ??
          0.1
        "
        @update:model-value="updateOption('mirostat_eta', $event)"
        :min="0.01"
        :max="1"
        :step="0.01"
        compact
      />

      <SettingsSlider
        label="Repeat Penalty"
        :model-value="
          modelValue.repeat_penalty ?? settingsStore.chatOptions.repeat_penalty
        "
        @update:model-value="updateOption('repeat_penalty', $event)"
        :min="1"
        :max="2"
        :step="0.05"
        compact
      />

      <SettingsSlider
        label="Repeat Last N"
        :model-value="
          modelValue.repeat_last_n ?? settingsStore.chatOptions.repeat_last_n
        "
        @update:model-value="updateOption('repeat_last_n', $event)"
        :min="0"
        :max="512"
        :step="8"
        compact
      />

      <!-- Seed -->
      <div
        class="flex flex-col gap-2 pt-1 border-t border-[var(--border-subtle)]"
      >
        <div>
          <p class="text-[11px] font-bold text-[var(--text)]">Seed</p>
          <p class="text-[10px] text-[var(--text-dim)] mt-0.5">
            Fixed integer for reproducible generation. Leave empty for random
            output.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="number"
            :value="props.modelValue.seed ?? ''"
            @change="updateSeed(($event.target as HTMLInputElement).value)"
            placeholder="empty = random"
            class="flex-1 bg-[var(--bg-input)] border text-[var(--text)] rounded-lg px-2 py-1 text-[11px] outline-none transition-colors"
            :class="
              props.modelValue.seed !== undefined
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-[var(--border)] focus:border-[var(--accent)]'
            "
          />
          <button
            v-if="props.modelValue.seed !== undefined"
            @click="updateSeed('')"
            class="text-[10px] px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors cursor-pointer whitespace-nowrap"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { useSettingsStore } from "../../../stores/settings";
import type { ChatOptions, PresetOptions } from "../../../types/settings";
import SettingsSlider from "../../settings/SettingsSlider.vue";
import MirostatSelector from "../../shared/MirostatSelector.vue";
import { useModelDefaults } from "../../../composables/useModelDefaults";

const props = defineProps<{
  modelValue: Partial<ChatOptions>;
  presetId: string;
  model?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: Partial<ChatOptions>): void;
  (e: "update:presetId", value: string): void;
  (e: "reset"): void;
}>();

const settingsStore = useSettingsStore();
const { saveAsModelDefault } = useModelDefaults();

const saving = ref(false);
const saveName = ref("");
const saveInput = ref<HTMLInputElement | null>(null);
const savedAsDefault = ref(false);
const savingDefault = ref(false);
const saveDefaultError = ref(false);

const isPresetOpen = ref(false);
const presetDropdownRef = ref<HTMLElement | null>(null);

const effectiveMirostat = computed(
  () => props.modelValue.mirostat ?? settingsStore.chatOptions.mirostat ?? 0,
);

const currentPresetLabel = computed(() => {
  if (!props.presetId) return "Custom";
  return (
    settingsStore.presets.find((p) => p.id === props.presetId)?.name ?? "Custom"
  );
});

function closePresetDropdown(e: MouseEvent) {
  if (
    isPresetOpen.value &&
    presetDropdownRef.value &&
    !presetDropdownRef.value.contains(e.target as Node)
  ) {
    isPresetOpen.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", closePresetDropdown));
onUnmounted(() =>
  document.removeEventListener("mousedown", closePresetDropdown),
);

function selectPreset(id: string) {
  isPresetOpen.value = false;
  if (!id) {
    emit("update:presetId", "");
    return;
  }
  const preset = settingsStore.presets.find((p) => p.id === id);
  if (!preset) return;
  emit("update:modelValue", { ...preset.options });
  emit("update:presetId", id);
}

function updateOption(key: keyof ChatOptions, value: number) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
  emit("update:presetId", "");
}

function updateMirostat(value: 0 | 1 | 2) {
  emit("update:modelValue", { ...props.modelValue, mirostat: value });
  emit("update:presetId", "");
}

function updateSeed(raw: string) {
  const parsed = raw === "" ? undefined : Number.parseInt(raw, 10);
  emit("update:modelValue", {
    ...props.modelValue,
    seed: Number.isNaN(parsed) ? undefined : parsed,
  });
  emit("update:presetId", "");
}

function resolveCurrentOptions(): PresetOptions {
  const mv = props.modelValue;
  const defaults = settingsStore.chatOptions;
  return {
    temperature: mv.temperature ?? defaults.temperature,
    top_p: mv.top_p ?? defaults.top_p,
    top_k: mv.top_k ?? defaults.top_k,
    num_ctx: mv.num_ctx ?? defaults.num_ctx,
    repeat_penalty: mv.repeat_penalty ?? defaults.repeat_penalty,
    repeat_last_n: mv.repeat_last_n ?? defaults.repeat_last_n,
    mirostat: mv.mirostat ?? defaults.mirostat,
    mirostat_tau: mv.mirostat_tau ?? defaults.mirostat_tau,
    mirostat_eta: mv.mirostat_eta ?? defaults.mirostat_eta,
  };
}

async function startSave() {
  saving.value = true;
  saveName.value = "";
  await nextTick();
  saveInput.value?.focus();
}

async function commitSave() {
  if (!saveName.value.trim()) return;
  await settingsStore.saveAsPreset(saveName.value, resolveCurrentOptions());
  saving.value = false;
  saveName.value = "";
}

async function handleSaveAsModelDefault() {
  if (!props.model || savingDefault.value) return;
  const effective = resolveCurrentOptions();
  savingDefault.value = true;
  saveDefaultError.value = false;
  savedAsDefault.value = false;
  try {
    await saveAsModelDefault(props.model, effective);
    savedAsDefault.value = true;
    setTimeout(() => {
      savedAsDefault.value = false;
    }, 2000);
  } catch (e) {
    console.error("[AdvancedChatOptions] set_model_defaults failed:", e);
    saveDefaultError.value = true;
    setTimeout(() => {
      saveDefaultError.value = false;
    }, 3000);
  } finally {
    savingDefault.value = false;
  }
}
</script>
