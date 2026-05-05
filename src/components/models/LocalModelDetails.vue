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
        <button
          v-if="isSignedIn"
          @click="openPushDialog"
          :disabled="activePushState?.phase === 'running'"
          class="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="16 16 12 12 8 16" />
            <line x1="12" y1="12" x2="12" y2="21" />
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
          </svg>
          {{
            activePushState?.phase === "running"
              ? `Pushing… ${Math.round(activePushState.percent)}%`
              : "Push to Cloud"
          }}
        </button>
        <p
          v-if="activePushState?.phase === 'done'"
          class="text-[11px] text-green-500 font-medium"
        >
          Pushed successfully
        </p>
        <p
          v-else-if="activePushState?.phase === 'error'"
          class="text-[11px] text-red-400 font-medium max-w-[160px] leading-tight"
        >
          {{ activePushState.error }}
        </p>
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
        <MirostatSelector
          :model-value="effectiveMirostat"
          @update:model-value="updateMirostat"
        />
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
          v-if="effectiveMirostat === 0"
          label="Top P"
          :model-value="edited.top_p ?? settingsStore.chatOptions.top_p"
          @update:model-value="edited = { ...edited, top_p: $event }"
          :min="0"
          :max="1"
          :step="0.05"
        />
        <SettingsSlider
          v-if="effectiveMirostat === 0"
          label="Top K"
          :model-value="edited.top_k ?? settingsStore.chatOptions.top_k"
          @update:model-value="edited = { ...edited, top_k: $event }"
          :min="0"
          :max="500"
          :step="1"
        />
        <SettingsSlider
          v-if="effectiveMirostat !== 0"
          label="Mirostat Tau"
          :model-value="
            edited.mirostat_tau ?? settingsStore.chatOptions.mirostat_tau ?? 5
          "
          @update:model-value="edited = { ...edited, mirostat_tau: $event }"
          :min="0.1"
          :max="10"
          :step="0.1"
        />
        <SettingsSlider
          v-if="effectiveMirostat !== 0"
          label="Mirostat Eta"
          :model-value="
            edited.mirostat_eta ?? settingsStore.chatOptions.mirostat_eta ?? 0.1
          "
          @update:model-value="edited = { ...edited, mirostat_eta: $event }"
          :min="0.01"
          :max="1"
          :step="0.01"
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

        <!-- Seed -->
        <div class="flex flex-col gap-2">
          <div>
            <p class="text-[13px] font-semibold text-[var(--text)]">Seed</p>
            <p class="text-[11.5px] text-[var(--text-dim)] mt-0.5">
              Fixed integer for reproducible generation. Leave empty for random
              output.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="number"
              :value="edited.seed ?? ''"
              @change="
                updateEditedSeed(($event.target as HTMLInputElement).value)
              "
              placeholder="empty = random"
              class="flex-1 bg-[var(--bg-input)] border text-[var(--text)] rounded-lg px-2 py-1.5 text-[12px] outline-none transition-colors"
              :class="
                edited.seed !== undefined
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border border-[var(--border)] focus:border-[var(--accent)]'
              "
            />
            <button
              v-if="edited.seed !== undefined"
              @click="edited = { ...edited, seed: undefined }"
              class="text-[11px] px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors cursor-pointer whitespace-nowrap"
            >
              Reset
            </button>
          </div>
        </div>

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

  <Teleport to="body">
    <div
      v-if="showPushDialog"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      @click.self="showPushDialog = false"
    >
      <div
        class="bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl p-6 w-[380px] shadow-2xl animate-in fade-in zoom-in duration-150"
      >
        <p class="text-[15px] font-bold text-[var(--text)] mb-1">
          Push to Ollama Cloud
        </p>
        <p class="text-[12px] text-[var(--text-muted)] mb-4 leading-relaxed">
          The model will be published to your Ollama account at ollama.com. You
          can edit the name below.
        </p>
        <input
          v-model="pushCloudName"
          @keydown.enter="startPush"
          @keydown.escape="showPushDialog = false"
          placeholder="username/model:latest"
          class="w-full bg-[var(--bg-input)] border border-[var(--border)] focus:border-[var(--accent)]/60 rounded-xl px-4 py-2.5 text-[13px] text-[var(--text)] outline-none placeholder-[var(--text-dim)] mb-2"
          autofocus
        />
        <p v-if="pushError" class="text-[11px] text-red-400 mb-2">
          {{ pushError }}
        </p>
        <div class="flex gap-2 justify-end">
          <button
            @click="showPushDialog = false"
            class="px-4 py-1.5 text-[12px] text-[var(--text-muted)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            @click="startPush"
            class="px-4 py-1.5 text-[12px] font-semibold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors"
          >
            Push
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../../stores/settings";
import { useModelStore } from "../../stores/models";
import { useAppOrchestration } from "../../composables/useAppOrchestration";
import { useModelDefaults } from "../../composables/useModelDefaults";
import SettingsSlider from "../settings/SettingsSlider.vue";
import MirostatSelector from "../shared/MirostatSelector.vue";
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

const isSignedIn = ref(false);
const ollamaUsername = ref("");
const showPushDialog = ref(false);
const pushCloudName = ref("");
const pushError = ref("");

const activePushState = computed(() => {
  const localName = props.model.name;
  return (
    Object.values(modelStore.pushing).find((s) => s.name === localName) ?? null
  );
});

function openPushDialog() {
  const base =
    props.model.name.split("/").pop()?.split(":")[0] ?? props.model.name;
  pushCloudName.value = ollamaUsername.value
    ? `${ollamaUsername.value}/${base}`
    : base;
  pushError.value = "";
  showPushDialog.value = true;
}

async function startPush() {
  pushError.value = "";
  const cloudName = pushCloudName.value.trim();
  if (!cloudName) {
    pushError.value = "Enter a cloud model name (e.g. username/model)";
    return;
  }
  if (!cloudName.includes("/")) {
    pushError.value = "Name must include your username (e.g. username/model)";
    return;
  }
  showPushDialog.value = false;
  await modelStore.pushModel(props.model.name, cloudName);
}

const loading = ref(true);
const edited = ref<Partial<ChatOptions>>({});

const effectiveMirostat = computed(
  () => edited.value.mirostat ?? settingsStore.chatOptions.mirostat ?? 0,
);

function updateMirostat(value: 0 | 1 | 2) {
  edited.value = { ...edited.value, mirostat: value };
}
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
    isSignedIn.value = await invoke<boolean>("check_ollama_signed_in");
  } catch {
    isSignedIn.value = false;
  }
  if (isSignedIn.value) {
    try {
      ollamaUsername.value = await invoke<string>("get_ollama_username");
    } catch {
      ollamaUsername.value = "";
    }
  }
  try {
    const stored = await applyModelDefaults(props.model.name);
    edited.value = { ...stored };
  } catch {
    // fall back to empty defaults on IPC failure
  } finally {
    loading.value = false;
  }
});

function updateEditedSeed(raw: string) {
  const n = Number.parseInt(raw, 10);
  edited.value = {
    ...edited.value,
    seed: raw === "" || Number.isNaN(n) ? undefined : n,
  };
}

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
