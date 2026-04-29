<template>
  <div
    class="flex flex-col h-full animate-in fade-in slide-in-from-left-2 duration-300"
  >
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2.5 mb-5">
      <button
        @click="$emit('back')"
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
        <span>Local Models</span>
      </button>
      <span class="text-[var(--text-dim)] text-[12px] opacity-60">/</span>
      <span class="text-[13px] text-[var(--text)] font-semibold">{{
        model.name
      }}</span>
    </div>

    <!-- Model header -->
    <div
      class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5 mb-4 flex items-start gap-4"
    >
      <div
        class="w-11 h-11 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-strong)] flex items-center justify-center font-bold text-[18px] text-[var(--text)] flex-shrink-0"
      >
        {{ model.name.charAt(0).toUpperCase() }}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[15px] font-bold text-[var(--text)] mb-1">
          {{ model.name }}
        </p>
        <p class="text-[12px] text-[var(--text-muted)]">
          {{ formatSize(model.size) }}
          <template v-if="model.details.quantization_level">
            · {{ model.details.quantization_level }}</template
          >
          <template v-if="model.details.parameter_size">
            · {{ model.details.parameter_size }}</template
          >
        </p>
        <div class="flex gap-1.5 mt-2 flex-wrap">
          <span
            v-if="caps?.vision"
            class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"
            >vision</span
          >
          <span
            v-if="caps?.tools"
            class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20"
            >tools</span
          >
          <span
            v-if="caps?.thinking"
            class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
            >thinking</span
          >
        </div>
      </div>
      <button
        @click="startChat"
        class="flex-shrink-0 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer"
      >
        Start Chat
      </button>
    </div>

    <!-- Default generation settings -->
    <div
      class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-5"
    >
      <p
        class="text-[12px] font-bold text-[var(--text)] uppercase tracking-wider mb-4"
      >
        Default Generation Settings
      </p>

      <div
        v-if="loading"
        class="text-[13px] text-[var(--text-dim)] text-center py-4"
      >
        Loading…
      </div>

      <div v-else class="flex flex-col gap-5">
        <SettingsSlider
          label="Temperature"
          :model-value="
            edited.temperature ?? settingsStore.chatOptions.temperature
          "
          @update:model-value="edited = { ...edited, temperature: $event }"
          :min="0"
          :max="1"
          :step="0.05"
        />
        <SettingsSlider
          label="Context (tokens)"
          :model-value="edited.num_ctx ?? settingsStore.chatOptions.num_ctx"
          @update:model-value="edited = { ...edited, num_ctx: $event }"
          :min="512"
          :max="131072"
          :step="512"
        />
        <SettingsSlider
          label="Top P"
          :model-value="edited.top_p ?? settingsStore.chatOptions.top_p"
          @update:model-value="edited = { ...edited, top_p: $event }"
          :min="0"
          :max="1"
          :step="0.05"
        />
        <SettingsSlider
          label="Top K"
          :model-value="edited.top_k ?? settingsStore.chatOptions.top_k"
          @update:model-value="edited = { ...edited, top_k: $event }"
          :min="0"
          :max="100"
          :step="1"
        />
        <SettingsSlider
          label="Repeat Penalty"
          :model-value="
            edited.repeat_penalty ?? settingsStore.chatOptions.repeat_penalty
          "
          @update:model-value="edited = { ...edited, repeat_penalty: $event }"
          :min="1"
          :max="2"
          :step="0.05"
        />
        <SettingsSlider
          label="Repeat Last N"
          :model-value="
            edited.repeat_last_n ?? settingsStore.chatOptions.repeat_last_n
          "
          @update:model-value="edited = { ...edited, repeat_last_n: $event }"
          :min="0"
          :max="128"
          :step="8"
        />

        <div
          class="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]"
        >
          <button
            data-testid="reset-defaults"
            @click="resetToGlobal"
            class="text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
          >
            Reset to global defaults
          </button>
          <button
            data-testid="save-defaults"
            @click="saveDefaults"
            class="px-4 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
          >
            {{ saved ? "Saved ✓" : "Save" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useSettingsStore } from "../../stores/settings";
import { useModelStore } from "../../stores/models";
import { useAppOrchestration } from "../../composables/useAppOrchestration";
import { useModelDefaults } from "../../composables/useModelDefaults";
import SettingsSlider from "../settings/SettingsSlider.vue";
import type { Model } from "../../types/models";
import type { ChatOptions } from "../../types/settings";

const props = defineProps<{ model: Model }>();
defineEmits<{ (e: "back"): void }>();

const router = useRouter();
const settingsStore = useSettingsStore();
const modelStore = useModelStore();
const { startNewChat } = useAppOrchestration();
const { applyModelDefaults, saveAsModelDefault } = useModelDefaults();

const loading = ref(true);
const edited = ref<Partial<ChatOptions>>({});
const saved = ref(false);

const caps = modelStore.getCapabilities(props.model.name);

onMounted(async () => {
  try {
    const stored = await applyModelDefaults(props.model.name);
    edited.value = { ...stored };
  } catch {
    // fall back to empty defaults on IPC failure
  } finally {
    loading.value = false;
  }
});

function resetToGlobal() {
  edited.value = { ...settingsStore.chatOptions };
}

async function saveDefaults() {
  try {
    await saveAsModelDefault(props.model.name, edited.value);
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 1500);
  } catch {
    // IPC failure — leave edited state intact so user can retry
  }
}

function startChat() {
  startNewChat(props.model.name);
  router.push("/chat");
}

function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${bytes} B`;
}
</script>
