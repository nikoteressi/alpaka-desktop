<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { tauriApi } from "../../lib/tauri";
import {
  useChatStore,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from "../../stores/chat";
import { useModelStore } from "../../stores/models";
import { useSettingsStore } from "../../stores/settings";
import { useDraftManager } from "../../composables/useDraftManager";
import { useConversationLifecycle } from "../../composables/useConversationLifecycle";
import { useContextWindow } from "../../composables/useContextWindow";
import { useAttachments } from "../../composables/useAttachments";
import { useModelDefaults } from "../../composables/useModelDefaults";
import type { ChatOptions } from "../../types/settings";

// Components
import SystemPromptPanel from "./input/SystemPromptPanel.vue";
import ModelSelector from "./input/ModelSelector.vue";
import AttachmentList from "./input/AttachmentList.vue";
import ContextBar from "./input/ContextBar.vue";
import ContextPill from "./input/ContextPill.vue";
import AdvancedChatOptions from "./input/AdvancedChatOptions.vue";
import CustomTooltip from "../shared/CustomTooltip.vue";

const props = defineProps<{
  isStreaming: boolean;
}>();

const emit = defineEmits<{
  (
    e: "send",
    text: string,
    images?: Uint8Array[],
    webSearchEnabled?: boolean,
    thinkMode?: string,
    chatOptions?: ChatOptions,
  ): void;
  (e: "stop"): void;
}>();

const chatStore = useChatStore();
const modelStore = useModelStore();
const settingsStore = useSettingsStore();
const { persistDraft, setDraft, clearDraft } = useDraftManager();
const { updateSystemPrompt } = useConversationLifecycle();
const { applyModelDefaults } = useModelDefaults();

const activeConvId = computed(() => chatStore.activeConversationId);

// ---- Linked Context ----
const isLinking = ref(false);

async function pickContext(isFolder: boolean) {
  if (!activeConvId.value) return;

  // Auto-persist draft if needed so we have a real DB ID for the context link
  let targetId = activeConvId.value;
  if (chatStore.isDraft) {
    targetId = await persistDraft();
  }

  isLinking.value = true;
  try {
    const selected = await open({
      directory: isFolder,
      multiple: false,
      title: isFolder ? "Select Folder to Link" : "Select File to Link",
    });
    if (!selected || typeof selected !== "string") return;
    const payload = await tauriApi.linkFolder(targetId, selected);

    chatStore.addFolderContext(targetId, {
      id: payload.id,
      name: selected.split("/").pop() ?? selected,
      path: selected,
      content: payload.content,
      tokens: payload.token_estimate,
    });
  } catch (err) {
    console.error("Failed to link context:", err);
  } finally {
    isLinking.value = false;
  }
}

async function removeContext(contextId: string) {
  if (!activeConvId.value) return;
  try {
    await tauriApi.unlinkFolder(contextId);
    chatStore.removeFolderContext(activeConvId.value, contextId);
  } catch (err) {
    console.error("Failed to unlink context:", err);
  }
}

const linkedContexts = computed(
  () => chatStore.folderContexts[activeConvId.value ?? ""] ?? [],
);

// ---- System prompt ----
const isSystemPromptOpen = ref(false);
const systemPromptDraft = ref("");

function toggleSystemPrompt() {
  if (!isSystemPromptOpen.value) {
    systemPromptDraft.value = chatStore.activeSystemPrompt;
  }
  isSystemPromptOpen.value = !isSystemPromptOpen.value;
}

async function saveSystemPrompt() {
  if (!chatStore.activeConversationId) return;
  await updateSystemPrompt(
    chatStore.activeConversationId,
    systemPromptDraft.value,
  );
  isSystemPromptOpen.value = false;
}

function cancelSystemPrompt() {
  isSystemPromptOpen.value = false;
  systemPromptDraft.value = chatStore.activeSystemPrompt;
}

// ---- Model selector ----
const activeModelName = computed(
  () => chatStore.activeConversation?.model || "Select model",
);

const isActiveModelPulling = computed(() => {
  const name = activeModelName.value;
  return !!modelStore.pulling[name];
});

function isCloudName(name: string) {
  // Check if the tag part (after :) contains 'cloud'
  if (!name.includes(":")) return false;
  const [, tag] = name.split(":");
  return tag?.toLowerCase().includes("cloud") ?? false;
}

async function selectModel(model: string) {
  if (isCloudName(model)) {
    await modelStore.addCloudModel(model);
  }

  if (chatStore.draftConversation && chatStore.isDraft) {
    chatStore.draftConversation.model = model;
  } else {
    const conv = chatStore.conversations.find(
      (c) => c.id === chatStore.activeConversationId,
    );
    if (conv) conv.model = model;
    try {
      await tauriApi.updateConversationModel(
        chatStore.activeConversationId!,
        model,
      );
    } catch {
      // Ignored
    }
  }

  try {
    chatOptions.value = await applyModelDefaults(model);
  } catch {
    // ignore — chatOptions stays as-is on IPC failure
  }
  presetId.value = "";
}

async function selectLibraryModel(name: string) {
  if (chatStore.draftConversation && chatStore.isDraft) {
    chatStore.draftConversation.model = name;
  } else {
    const conv = chatStore.conversations.find(
      (c) => c.id === chatStore.activeConversationId,
    );
    if (conv) conv.model = name;
  }

  if (isCloudName(name)) {
    modelStore.addCloudModel(name);
  }
  await modelStore.pullModel(name);
}

// ---- Web search & reasoning ----
const webSearchEnabled = ref(false);
const thinkEnabled = ref(false);
const thinkLevel = ref<"low" | "medium" | "high">("medium");
const isAdvancedOptionsOpen = ref(false);
const chatOptions = ref<ChatOptions>({});
const presetId = ref<string>("");

function parseChatOptionsJson(raw: string): Partial<ChatOptions> | null {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj !== "object" || obj === null) return null;
    const out: Partial<ChatOptions> = {};
    if (typeof obj.temperature === "number") out.temperature = obj.temperature;
    if (typeof obj.top_p === "number") out.top_p = obj.top_p;
    if (typeof obj.top_k === "number") out.top_k = obj.top_k;
    if (typeof obj.num_ctx === "number") out.num_ctx = obj.num_ctx;
    if (typeof obj.repeat_penalty === "number")
      out.repeat_penalty = obj.repeat_penalty;
    if (typeof obj.repeat_last_n === "number")
      out.repeat_last_n = obj.repeat_last_n;
    if (obj.mirostat === 0 || obj.mirostat === 1 || obj.mirostat === 2)
      out.mirostat = obj.mirostat;
    if (typeof obj.mirostat_tau === "number")
      out.mirostat_tau = obj.mirostat_tau;
    if (typeof obj.mirostat_eta === "number")
      out.mirostat_eta = obj.mirostat_eta;
    return out;
  } catch {
    return null;
  }
}

function resetChatOptions() {
  const defaultPreset = settingsStore.presets.find(
    (p) => p.id === settingsStore.defaultPresetId,
  );
  if (defaultPreset) {
    chatOptions.value = { ...defaultPreset.options };
    presetId.value = defaultPreset.id;
  } else {
    chatOptions.value = {};
    presetId.value = "";
  }
}

watch(
  activeModelName,
  async (name) => {
    if (name && name !== "Select model") {
      await modelStore.fetchCapabilities(name);
      try {
        chatOptions.value = await applyModelDefaults(name);
        presetId.value = "";
        if (!chatStore.isDraft && activeConvId.value) {
          await tauriApi.updateConversationSettings(
            activeConvId.value,
            chatOptions.value,
          );
        }
      } catch {
        // ignore IPC failure
      }
    }
  },
  { immediate: true },
);

const modelCaps = computed(() =>
  modelStore.getCapabilities(activeModelName.value),
);

const supportsThinking = computed(
  () => modelCaps.value?.thinking_toggleable || false,
);
const supportsThinkingLevels = computed(
  () => (modelCaps.value?.thinking_levels?.length ?? 0) > 0,
);
const modelSupportsTools = computed(() => modelCaps.value?.tools || false);

const isCurrentChatStreaming = computed(
  () =>
    chatStore.streaming.isStreaming &&
    chatStore.streaming.currentConversationId === activeConvId.value,
);

const isCompacting = ref(false);

// ---- Text input ----
const inputContent = ref("");
const isSyncingDraft = ref(false);

// ---- Image attachment previews ----
const {
  attachments,
  isDragging,
  handleFiles,
  removeAttachment,
  clearAttachments,
  onDragEnter,
  onDragLeave,
  onDrop,
  onPaste,
} = useAttachments();

// ---- Context Window Tracking ----
const { maxContext, contextTokens, isContextNearFull } = useContextWindow({
  inputLength: computed(() => inputContent.value.length),
  attachmentCount: computed(() => attachments.value.length),
  numCtxOverride: computed(
    () => Number(chatOptions.value?.num_ctx) || undefined,
  ),
  modelNativeCtx: computed(() => modelCaps.value?.context_length),
  globalNumCtx: computed(() => settingsStore.chatOptions.num_ctx),
  globalSystemPrompt: computed(() => settingsStore.globalSystemPrompt || ""),
  isStreaming: isCurrentChatStreaming,
});

// ---- Drag and drop & Paste ----
// Provided by useAttachments composable

const imageInput = ref<HTMLInputElement | null>(null);
const isAttachMenuOpen = ref(false);
const attachMenuRef = ref<HTMLElement | null>(null);

function triggerImageUpload() {
  isAttachMenuOpen.value = false;
  imageInput.value?.click();
}

async function onImageInputChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files) await handleFiles(files);
  if (imageInput.value) imageInput.value.value = "";
}

function toggleAttachMenu() {
  isAttachMenuOpen.value = !isAttachMenuOpen.value;
}

function closeAttachMenu(e: MouseEvent) {
  if (isAttachMenuOpen.value && attachMenuRef.value) {
    if (!attachMenuRef.value.contains(e.target as Node)) {
      isAttachMenuOpen.value = false;
    }
  }
}

onMounted(() => {
  document.addEventListener("mousedown", closeAttachMenu);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", closeAttachMenu);
});

// ---- Submit ----
function handleEnter(e: KeyboardEvent) {
  if (!e.shiftKey) handleSubmit();
}

function handleSubmit() {
  if (props.isStreaming) {
    emit("stop");
    return;
  }

  const text = inputContent.value.trim();
  const validAttachments = attachments.value
    .filter((a) => a.data !== null)
    .map((a) => a.data as Uint8Array);

  if (!text && validAttachments.length === 0) return;

  let thinkMode: string | undefined;
  if (supportsThinkingLevels.value) {
    thinkMode = thinkLevel.value;
  } else if (supportsThinking.value) {
    thinkMode = thinkEnabled.value ? "true" : "false";
  }

  emit(
    "send",
    text,
    validAttachments.length > 0 ? validAttachments : undefined,
    settingsStore.cloud && modelSupportsTools.value
      ? webSearchEnabled.value
      : undefined,
    thinkMode,
    Object.keys(chatOptions.value).length > 0 ? chatOptions.value : undefined,
  );

  inputContent.value = "";
  clearAttachments();

  if (activeConvId.value) {
    clearDraft(activeConvId.value);
  }
}

async function handleCompact() {
  if (
    !activeConvId.value ||
    !activeModelName.value ||
    activeModelName.value === "Select model"
  )
    return;
  isCompacting.value = true;
  try {
    const newConvId = await chatStore.compactConversation(
      activeConvId.value,
      activeModelName.value,
    );
    await chatStore.loadConversation(newConvId);
  } catch (e) {
    console.error("Compact failed:", e);
  } finally {
    isCompacting.value = false;
  }
}

// ---- Draft Sync Logic ----

function applyDraft(
  draft: (typeof chatStore.drafts)[string],
  convIdAtLoad: string,
) {
  inputContent.value = draft.content;
  webSearchEnabled.value = draft.webSearchEnabled;
  thinkEnabled.value = draft.thinkEnabled;
  thinkLevel.value = draft.thinkLevel;
  chatOptions.value = draft.chatOptions || {};
  presetId.value = draft.presetId ?? "";
  clearAttachments();
  attachments.value = draft.attachments.map((a) => {
    const data = base64ToUint8Array(a.data);
    const blob = new Blob([data], { type: a.type });
    return {
      file: new File([blob], a.name, { type: a.type }),
      previewUrl: URL.createObjectURL(blob),
      data,
    };
  });
  if (draft.linkedContexts) {
    chatStore.folderContexts[convIdAtLoad] = draft.linkedContexts;
  }
}

async function applyNoDraftSettings(convIdAtLoad: string) {
  inputContent.value = "";
  clearAttachments();
  webSearchEnabled.value = false;
  thinkEnabled.value = false;
  thinkLevel.value = "medium";
  const conv = chatStore.conversations.find((c) => c.id === convIdAtLoad);
  const savedSettings = conv?.settings_json
    ? parseChatOptionsJson(conv.settings_json)
    : null;
  if (savedSettings && Object.keys(savedSettings).length > 0) {
    chatOptions.value = savedSettings;
    presetId.value = "";
    return;
  }
  // No saved settings — apply model defaults so per-model options (e.g. mirostat)
  // survive across conversation switches even when the model name hasn't changed.
  const modelName = activeModelName.value;
  if (!modelName || modelName === "Select model") {
    resetChatOptions();
    return;
  }
  try {
    const defaults = await applyModelDefaults(modelName);
    if (activeConvId.value !== convIdAtLoad) return;
    if (Object.keys(defaults).length > 0) {
      chatOptions.value = defaults;
      presetId.value = "";
    } else {
      resetChatOptions();
    }
  } catch {
    resetChatOptions();
  }
}

async function loadDraft() {
  if (!activeConvId.value) return;
  const convIdAtLoad = activeConvId.value;
  isSyncingDraft.value = true;
  const draft = chatStore.drafts[convIdAtLoad];
  if (draft) {
    applyDraft(draft, convIdAtLoad);
  } else {
    await applyNoDraftSettings(convIdAtLoad);
  }
  nextTick(() => {
    isSyncingDraft.value = false;
  });
}

function saveDraft() {
  if (!activeConvId.value || isSyncingDraft.value) return;

  const draftAttachments = attachments.value
    .filter((a) => a.data)
    .map((a) => ({
      name: a.file.name,
      type: a.file.type,
      data: uint8ArrayToBase64(a.data!),
    }));

  setDraft(activeConvId.value, {
    content: inputContent.value,
    attachments: draftAttachments,
    linkedContexts: linkedContexts.value,
    webSearchEnabled: webSearchEnabled.value,
    thinkEnabled: thinkEnabled.value,
    thinkLevel: thinkLevel.value,
    chatOptions: chatOptions.value,
    presetId: presetId.value,
  });
}

// Debounced draft save to avoid writing on every keystroke
let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedSaveDraft() {
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    saveDraft();
    draftSaveTimer = null;
  }, 500);
}

// Watchers for auto-saving (debounced)
watch(
  [
    inputContent,
    webSearchEnabled,
    thinkEnabled,
    thinkLevel,
    chatOptions,
    presetId,
  ],
  () => {
    debouncedSaveDraft();
  },
  { deep: true },
);

// Deep watch for attachments and linkedContexts (debounced)
watch(
  [() => attachments.value.length, () => linkedContexts.value.length],
  () => {
    debouncedSaveDraft();
  },
);

// Load draft on chat switch (NOT debounced — must be immediate and synchronous)
watch(
  activeConvId,
  () => {
    loadDraft();
  },
  { immediate: true },
);

onMounted(() => {
  modelStore.fetchModels();
});

onUnmounted(() => {
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
});
</script>

<template>
  <div
    class="flex flex-col w-full max-w-4xl mx-auto px-4 pb-4 pt-2 transition-all duration-300"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <SystemPromptPanel
      v-model:systemPromptDraft="systemPromptDraft"
      :isOpen="isSystemPromptOpen"
      @save="saveSystemPrompt"
      @cancel="cancelSystemPrompt"
    />

    <input
      type="file"
      ref="imageInput"
      class="hidden"
      accept="image/*"
      multiple
      @change="onImageInputChange"
    />

    <!-- Main input container -->
    <div
      class="rounded-[20px] bg-[var(--bg-user-msg)] border border-[var(--border-strong)] px-[14px] py-[10px] relative"
    >
      <!-- Clipping layer to ensure ContextBar doesn't stick out at the rounded corners -->
      <div
        class="absolute inset-0 overflow-hidden rounded-[20px] pointer-events-none"
      >
        <ContextBar
          :contextTokens="contextTokens"
          :maxContext="maxContext"
          :isStreaming="isCurrentChatStreaming"
        />
      </div>

      <!-- Advanced Options Popover -->
      <transition name="pop-up">
        <div
          v-if="isAdvancedOptionsOpen"
          class="absolute bottom-full right-0 mb-3 z-40"
        >
          <AdvancedChatOptions
            v-model="chatOptions"
            v-model:presetId="presetId"
            :model="chatStore.activeConversation?.model"
            @reset="resetChatOptions"
          />
        </div>
      </transition>

      <!-- Drag overlay -->
      <div
        v-if="isDragging"
        class="absolute inset-0 z-30 bg-[var(--accent-muted)] backdrop-blur-[2px] border-2 border-dashed border-[var(--accent)] flex items-center justify-center pointer-events-none rounded-[20px]"
      >
        <span class="text-[var(--accent)] font-medium">Drop images here</span>
      </div>

      <!-- Linked Context List -->
      <div v-if="linkedContexts.length > 0" class="flex flex-wrap gap-2 mb-2">
        <div
          v-for="ctx in linkedContexts"
          :key="ctx.id"
          class="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg"
        >
          <svg
            v-if="ctx.path.includes('.')"
            class="w-3 h-3 text-[var(--accent)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <svg
            v-else
            class="w-3 h-3 text-[var(--accent)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            />
          </svg>
          <span
            class="text-[11px] font-medium text-[var(--text-muted)] truncate max-w-[120px]"
            >{{ ctx.name }}</span
          >
          <span class="text-[10px] text-[var(--text-dim)]"
            >~{{ ctx.tokens.toLocaleString() }}</span
          >
          <button
            @click="removeContext(ctx.id)"
            class="p-0.5 rounded hover:bg-[var(--bg-active)] text-[var(--text-dim)] hover:text-[var(--text-muted)] cursor-pointer transition-colors"
          >
            <svg
              class="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <AttachmentList :attachments="attachments" @remove="removeAttachment" />

      <textarea
        data-testid="chat-input"
        v-model="inputContent"
        @keydown.enter.prevent="handleEnter"
        @paste="onPaste"
        placeholder="Type a message or paste an image..."
        class="w-full bg-transparent focus:outline-none resize-none overflow-hidden text-[var(--text)] text-[13.5px] leading-relaxed placeholder-[var(--text-dim)] max-h-48 min-h-[36px]"
        :disabled="isStreaming"
        rows="1"
      />

      <div class="flex items-center justify-between mt-2">
        <div class="flex items-center gap-2">
          <ContextPill
            :contextTokens="contextTokens"
            :maxContext="maxContext"
          />

          <!-- Compact conversation button — visible when context >= 70% -->
          <CustomTooltip
            v-if="
              isContextNearFull && !isCurrentChatStreaming && !chatStore.isDraft
            "
            text="Summarize conversation and continue in a new chat"
            wrapper-class="flex-shrink-0"
          >
            <button
              @click="handleCompact"
              :disabled="isCompacting"
              class="flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[10px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <svg
                v-if="isCompacting"
                class="w-2.5 h-2.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <svg
                v-else
                class="w-2.5 h-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span>{{ isCompacting ? "Compacting…" : "Compact" }}</span>
            </button>
          </CustomTooltip>
        </div>

        <div class="flex items-center gap-1.5">
          <CustomTooltip text="System prompt" wrapper-class="flex-shrink-0">
            <button
              @click="toggleSystemPrompt"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              :class="
                isSystemPromptOpen
                  ? 'bg-[var(--bg-active)] border border-[var(--border-strong)] text-[var(--text)]'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text)]'
              "
              aria-label="Edit system prompt"
              :aria-pressed="isSystemPromptOpen"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 20h9" />
                <path
                  d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                />
              </svg>
            </button>
          </CustomTooltip>

          <div class="relative" ref="attachMenuRef">
            <CustomTooltip text="Attach" wrapper-class="block">
              <button
                @click="toggleAttachMenu"
                :disabled="isStreaming"
                class="w-7 h-7 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text)] transition-colors cursor-pointer disabled:opacity-40"
                :class="{
                  'text-[var(--text)] bg-[var(--bg-active)]': isAttachMenuOpen,
                }"
                aria-label="Attach"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </CustomTooltip>

            <!-- Attachment Menu -->
            <transition name="pop-up">
              <div
                v-if="isAttachMenuOpen"
                class="absolute bottom-full left-0 mb-3 z-50 w-44 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-xl shadow-2xl py-1 overflow-hidden"
              >
                <button
                  @click="triggerImageUpload"
                  class="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent"
                >
                  <svg
                    class="w-3.5 h-3.5 opacity-70"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Attach Images
                </button>
                <button
                  @click="
                    pickContext(false);
                    isAttachMenuOpen = false;
                  "
                  :disabled="isLinking"
                  class="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent disabled:opacity-50"
                >
                  <svg
                    class="w-3.5 h-3.5 opacity-70"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                    />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Link File Context
                </button>
                <button
                  @click="
                    pickContext(true);
                    isAttachMenuOpen = false;
                  "
                  :disabled="isLinking"
                  class="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent disabled:opacity-50"
                >
                  <svg
                    class="w-3.5 h-3.5 opacity-70"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                    />
                  </svg>
                  Link Folder Context
                </button>
              </div>
            </transition>
          </div>
          <!-- Web Search Toggle -->
          <CustomTooltip
            v-if="settingsStore.cloud && modelSupportsTools"
            :text="webSearchEnabled ? 'Web search on' : 'Web search off'"
            wrapper-class="flex-shrink-0"
          >
            <button
              @click="webSearchEnabled = !webSearchEnabled"
              aria-label="Enable web search"
              :aria-pressed="webSearchEnabled"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              :class="
                webSearchEnabled
                  ? 'bg-[var(--accent-muted)] border border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text)]'
              "
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path
                  d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                />
              </svg>
            </button>
          </CustomTooltip>
          <!-- Thinking Toggle -->
          <CustomTooltip
            v-if="supportsThinking"
            :text="thinkEnabled ? 'Thinking on' : 'Thinking off'"
            wrapper-class="flex-shrink-0"
          >
            <button
              @click="thinkEnabled = !thinkEnabled"
              aria-label="Enable thinking mode"
              :aria-pressed="thinkEnabled"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              :class="
                thinkEnabled
                  ? 'bg-[var(--tag-thinking-bg)] border border-[var(--tag-thinking-text)] text-[var(--tag-thinking-text)]'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text)]'
              "
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </button>
          </CustomTooltip>

          <CustomTooltip
            text="Advanced model parameters"
            wrapper-class="flex-shrink-0"
          >
            <button
              @click="isAdvancedOptionsOpen = !isAdvancedOptionsOpen"
              aria-label="Toggle advanced options"
              :aria-pressed="isAdvancedOptionsOpen"
              class="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              :class="
                isAdvancedOptionsOpen
                  ? 'bg-[var(--bg-active)] border border-[var(--border-strong)] text-[var(--accent)]'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text)]'
              "
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="2" y1="14" x2="6" y2="14" />
                <line x1="10" y1="8" x2="14" y2="8" />
                <line x1="18" y1="16" x2="22" y2="16" />
              </svg>
            </button>
          </CustomTooltip>

          <ModelSelector
            :activeModelName="activeModelName"
            :isActiveModelPulling="isActiveModelPulling"
            @select="selectModel"
            @pull="selectLibraryModel"
          />

          <div v-if="isStreaming" data-testid="streaming-indicator" style="display:none" />
          <button
            data-testid="send-btn"
            @click="handleSubmit"
            :disabled="
              !isStreaming && !inputContent.trim() && attachments.length === 0
            "
            :aria-label="isStreaming ? 'Stop generation' : 'Send message'"
            class="w-7 h-7 rounded-full flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer disabled:opacity-30"
            :class="
              isStreaming
                ? 'bg-[var(--bg-user-msg)] hover:bg-[var(--bg-active)]'
                : inputContent.trim() || attachments.length > 0
                  ? 'bg-[var(--text)] hover:bg-[var(--text-muted)]'
                  : 'bg-[var(--bg-user-msg)]'
            "
          >
            <svg
              v-if="isStreaming"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="text-[var(--text)]"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            <svg
              v-else
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              :stroke="
                inputContent.trim() || attachments.length > 0
                  ? '#1a1a1a'
                  : '#555'
              "
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
