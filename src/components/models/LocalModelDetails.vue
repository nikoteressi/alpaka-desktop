<template>
  <div
    class="flex flex-col h-full animate-in fade-in slide-in-from-left-2 duration-300"
  >
    <!-- Breadcrumb -->
    <div class="flex items-center gap-2.5 mb-5">
      <button
        @click="emit('back')"
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
        <div class="flex gap-1.5 mt-2 flex-wrap items-center">
          <span v-if="caps?.vision" class="model-tag tag-vision">vision</span>
          <span v-if="caps?.tools" class="model-tag tag-tools">tools</span>
          <span v-if="caps?.thinking" class="model-tag tag-thinking"
            >think</span
          >
          <template v-if="!editingTags">
            <span
              v-for="tag in userTags"
              :key="'user-' + tag"
              class="model-tag tag-user"
              >{{ tag }}</span
            >
            <button
              class="model-tag tag-generic cursor-pointer hover:opacity-80 transition-opacity"
              @click="openTagEdit"
            >
              {{ userTags.length > 0 ? "edit tags" : "+ add tags" }}
            </button>
          </template>
          <template v-else>
            <input
              ref="tagInputRef"
              v-model="tagInputValue"
              class="text-[11px] bg-[var(--bg-input)] border border-[var(--accent)]/50 rounded-lg px-2 py-0.5 text-[var(--text)] outline-none w-40"
              placeholder="tag1, tag2…"
              @keydown.enter="saveTags"
              @keydown.escape="editingTags = false"
              @blur="saveTags"
            />
          </template>
        </div>
      </div>
      <div class="flex flex-col gap-2 flex-shrink-0">
        <button
          @click="startChat"
          class="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-[13px] font-semibold transition-colors cursor-pointer"
        >
          Start Chat
        </button>
        <button
          @click="emit('edit-modelfile', model.name)"
          class="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors"
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Edit Modelfile
        </button>
      </div>
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
          :max="500"
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
          :max="512"
          :step="8"
        />
        <SettingsSlider
          label="Context (tokens)"
          :model-value="edited.num_ctx ?? settingsStore.chatOptions.num_ctx"
          @update:model-value="edited = { ...edited, num_ctx: $event }"
          :min="512"
          :max="131072"
          :step="512"
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
            class="px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors cursor-pointer"
            :class="
              saveError
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
            "
          >
            {{ saveError ? "Failed ✕" : saved ? "Saved ✓" : "Save" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { useSettingsStore } from "../../stores/settings";
import { useModelStore } from "../../stores/models";
import { useAppOrchestration } from "../../composables/useAppOrchestration";
import { useModelDefaults } from "../../composables/useModelDefaults";
import SettingsSlider from "../settings/SettingsSlider.vue";
import type { Model } from "../../types/models";
import type { ChatOptions } from "../../types/settings";

const props = defineProps<{ model: Model }>();
const emit = defineEmits<{
  (e: "back"): void;
  (e: "edit-modelfile", name: string): void;
}>();

const router = useRouter();
const settingsStore = useSettingsStore();
const modelStore = useModelStore();
const { startNewChat } = useAppOrchestration();
const { applyModelDefaults, saveAsModelDefault, resetModelDefaults } =
  useModelDefaults();

const loading = ref(true);
const edited = ref<Partial<ChatOptions>>({});
const saved = ref(false);
const saveError = ref(false);
const editingTags = ref(false);
const tagInputValue = ref("");
const tagInputRef = ref<HTMLInputElement | null>(null);

const caps = modelStore.getCapabilities(props.model.name);
const userTags = computed(() => modelStore.getUserTags(props.model.name));

async function openTagEdit() {
  tagInputValue.value = userTags.value.join(", ");
  editingTags.value = true;
  await nextTick();
  tagInputRef.value?.focus();
}

async function saveTags() {
  if (!editingTags.value) return;
  editingTags.value = false;
  const tags = tagInputValue.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  await modelStore.setModelTags(props.model.name, tags);
}

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

async function resetToGlobal() {
  await resetModelDefaults(props.model.name);
  edited.value = {};
}

async function saveDefaults() {
  saveError.value = false;
  try {
    await saveAsModelDefault(props.model.name, edited.value);
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 1500);
  } catch {
    saveError.value = true;
    setTimeout(() => {
      saveError.value = false;
    }, 2000);
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
