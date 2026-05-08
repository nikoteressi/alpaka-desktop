<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { tauriApi } from "../../lib/tauri";
import { useChatStore } from "../../stores/chat";
import { useModelStore } from "../../stores/models";
import { useSettingsStore } from "../../stores/settings";
import { useDraftManager } from "../../composables/useDraftManager";
import { useConversationLifecycle } from "../../composables/useConversationLifecycle";
import { useContextWindow } from "../../composables/useContextWindow";
import { useAttachments } from "../../composables/useAttachments";
import { useModelDefaults } from "../../composables/useModelDefaults";
import { useDraftSync } from "../../composables/useDraftSync";
import { useUndoHistory } from "../../composables/useUndoHistory";
import { appEvents, APP_EVENT } from "../../lib/appEvents";
import type { ChatOptions } from "../../types/settings";
import type { LinkedContext } from "../../types/chat";

// Components
import SystemPromptPanel from "./input/SystemPromptPanel.vue";
import ModelSelector from "./input/ModelSelector.vue";
import AttachmentList from "./input/AttachmentList.vue";
import ContextBar from "./input/ContextBar.vue";
import ContextPill from "./input/ContextPill.vue";
import AdvancedChatOptions from "./input/AdvancedChatOptions.vue";
import CustomTooltip from "../shared/CustomTooltip.vue";
import AttachMenu from "./input/AttachMenu.vue";
import ChatInputComposer from "./input/ChatInputComposer.vue";
import FolderFilePickerModal from "./input/FolderFilePickerModal.vue";

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
const { persistDraft } = useDraftManager();
const { updateSystemPrompt } = useConversationLifecycle();
const { applyModelDefaults } = useModelDefaults();

const activeConvId = computed(() => chatStore.activeConversationId);

// ---- Linked Context ----
const isLinking = ref(false);
const linkError = ref<string | null>(null);
let linkErrorTimer: ReturnType<typeof setTimeout> | null = null;

function showLinkError(msg: string) {
  linkError.value = msg;
  if (linkErrorTimer) clearTimeout(linkErrorTimer);
  linkErrorTimer = setTimeout(() => {
    linkError.value = null;
    linkErrorTimer = null;
  }, 4000);
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return "Failed to link file — binary or unreadable files cannot be used as context.";
}

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
    showLinkError(extractErrorMessage(err));
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

const pickerContext = ref<LinkedContext | null>(null);

function openFilePicker(ctx: LinkedContext) {
  pickerContext.value = ctx;
}

function closeFilePicker() {
  pickerContext.value = null;
}

async function handlePickerApply(
  files: string[],
  tokens: number,
  content: string,
) {
  if (!activeConvId.value || !pickerContext.value) return;
  chatStore.updateContextFiles(
    activeConvId.value,
    pickerContext.value.id,
    files,
    tokens,
    content,
  );
  closeFilePicker();
}

async function handlePickerDetach() {
  if (!pickerContext.value) return;
  await removeContext(pickerContext.value.id);
  closeFilePicker();
}

// ---- Folder refresh flash ----
const refreshingContextIds = ref(new Set<string>());

async function handleAutoRefreshToggle(contextId: string, enabled: boolean) {
  await tauriApi.setAutoRefresh(contextId, enabled);
  chatStore.setContextAutoRefresh(contextId, enabled);
}

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
  if (!chatStore.isDraft && activeConvId.value) {
    tauriApi
      .updateConversationSettings(activeConvId.value, chatOptions.value)
      .catch(() => {});
  }
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

const isCompactingActive = computed(
  () =>
    !!activeConvId.value &&
    !!chatStore.compactionInProgress[activeConvId.value],
);

const compactionTokens = computed(() =>
  activeConvId.value
    ? (chatStore.compactionTokens[activeConvId.value] ?? "")
    : "",
);

// ---- Text input ----
const inputContent = ref("");

// ---- Image attachment previews ----
const {
  attachments,
  isDragging,
  handleFiles,
  initDragDrop,
  removeAttachment,
  clearAttachments,
} = useAttachments({
  onLinkFile: async (path: string) => {
    let targetId = activeConvId.value;
    if (!targetId) return;
    if (chatStore.isDraft) targetId = await persistDraft();
    isLinking.value = true;
    try {
      const payload = await tauriApi.linkFolder(targetId, path);
      chatStore.addFolderContext(targetId, {
        id: payload.id,
        name: path.split("/").pop() ?? path,
        path,
        content: payload.content,
        tokens: payload.token_estimate,
      });
    } catch (err) {
      console.error("Failed to link dropped file:", err);
      showLinkError(extractErrorMessage(err));
    } finally {
      isLinking.value = false;
    }
  },
});

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

// ---- Undo/redo history ----
// WebKitGTK on Wayland doesn't route Ctrl+Z to the textarea's native undo stack,
// and execCommand("undo") conflicts with Vue's v-model (Vue resets the value on
// the next re-render). We maintain our own history keyed to inputContent.
const {
  scheduleSnapshot,
  undo: doUndo,
  redo: doRedo,
} = useUndoHistory(inputContent);

// Trigger undo snapshot whenever inputContent changes from user typing
watch(inputContent, scheduleSnapshot);

// ---- Submit ----
function handleEnter(e: KeyboardEvent) {
  if (!e.shiftKey) {
    e.preventDefault();
    handleSubmit();
  }
}

function handleTextareaKeydown(e: KeyboardEvent) {
  const ctrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (ctrl && key === "z" && !e.shiftKey) {
    e.preventDefault();
    doUndo();
    return;
  }
  if (ctrl && key === "z" && e.shiftKey) {
    e.preventDefault();
    doRedo();
    return;
  }
  if (e.key === "Enter") {
    handleEnter(e);
  }
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
  const compactionModel =
    settingsStore.compactionModel || activeModelName.value;
  await chatStore.compactConversation(activeConvId.value, compactionModel);
}

// ---- Draft Sync ----
const { clearDraft } = useDraftSync(
  {
    inputContent,
    webSearchEnabled,
    thinkEnabled,
    thinkLevel,
    chatOptions,
    presetId,
    attachments,
  },
  {
    activeConvId,
    activeModelName,
    linkedContexts,
    clearAttachments,
    applyModelDefaults,
    resetChatOptions,
    parseChatOptionsJson,
  },
);

const modelSelectorRef = ref<InstanceType<typeof ModelSelector> | null>(null);

function onOpenModelSwitcher() {
  modelSelectorRef.value?.openModelDropdown();
}

let unlistenDrag: (() => void) | undefined;
let unlistenFolderRefreshed: (() => void) | undefined;

onMounted(async () => {
  modelStore.fetchModels();
  appEvents.addEventListener(
    APP_EVENT.OPEN_MODEL_SWITCHER,
    onOpenModelSwitcher,
  );
  try {
    unlistenDrag = await initDragDrop();
  } catch {
    // drag-drop unavailable in non-Tauri context
  }
  unlistenFolderRefreshed = await listen<{
    context_id: string;
    token_estimate: number;
  }>("folder:refreshed", ({ payload }) => {
    chatStore.updateContextTokens(payload.context_id, payload.token_estimate);
    refreshingContextIds.value = new Set([
      ...refreshingContextIds.value,
      payload.context_id,
    ]);
    setTimeout(() => {
      refreshingContextIds.value = new Set(
        [...refreshingContextIds.value].filter(
          (id) => id !== payload.context_id,
        ),
      );
    }, 2000);
  });
});

onBeforeUnmount(() => {
  if (linkErrorTimer) clearTimeout(linkErrorTimer);
  appEvents.removeEventListener(
    APP_EVENT.OPEN_MODEL_SWITCHER,
    onOpenModelSwitcher,
  );
  unlistenDrag?.();
  unlistenFolderRefreshed?.();
  clearAttachments();
});
</script>

<template>
  <div
    class="flex flex-col w-full max-w-4xl mx-auto px-4 pb-4 pt-2 transition-all duration-300"
  >
    <SystemPromptPanel
      v-model:systemPromptDraft="systemPromptDraft"
      :isOpen="isSystemPromptOpen"
      @save="saveSystemPrompt"
      @cancel="cancelSystemPrompt"
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

      <!-- File link error -->
      <div v-if="linkError" class="text-[11px] text-red-400 mb-1 px-1">
        {{ linkError }}
      </div>

      <!-- Linked Context List -->
      <div v-if="linkedContexts.length > 0" class="flex flex-wrap gap-2 mb-2">
        <div
          v-for="ctx in linkedContexts"
          :key="ctx.id"
          :data-testid="`refresh-flash-${ctx.id}`"
          :class="{ 'is-refreshing': refreshingContextIds.has(ctx.id) }"
          class="flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
          @click="openFilePicker(ctx)"
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
          <span
            v-if="refreshingContextIds.has(ctx.id)"
            class="text-[var(--accent)] animate-pulse"
            aria-hidden="true"
            >↻</span
          >
          <button
            @click.stop="removeContext(ctx.id)"
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

      <ChatInputComposer
        v-model="inputContent"
        :isStreaming="isStreaming || isCompactingActive"
        :hasAttachments="attachments.length > 0"
        @keydown="handleTextareaKeydown"
        @submit="handleSubmit"
      />

      <!-- Compaction status bar -->
      <div
        v-if="isCompactingActive"
        class="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg border text-[12px]"
        :style="{
          background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
          borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)',
          color: 'var(--warning)',
        }"
      >
        <svg
          class="w-3 h-3 animate-spin flex-shrink-0"
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
            d="M4 12a8 8 0 018-8v8H4z"
          />
        </svg>
        <span class="flex-1 min-w-0 truncate">
          {{ compactionTokens || "Generating summary…" }}
        </span>
        <button
          @click="chatStore.cancelCompaction().catch(console.error)"
          class="flex-shrink-0 text-[11px] opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <div class="flex items-center justify-between mt-2">
        <div class="flex items-center gap-2">
          <ContextPill
            :contextTokens="contextTokens"
            :maxContext="maxContext"
          />

          <!-- Compact conversation button -->
          <CustomTooltip
            v-if="
              !isCurrentChatStreaming &&
              !chatStore.isDraft &&
              !!activeConvId &&
              activeModelName !== 'Select model'
            "
            text="Summarize and compact conversation in-place"
            wrapper-class="flex-shrink-0"
          >
            <button
              @click="handleCompact"
              :disabled="isCompactingActive"
              class="flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[10px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <svg
                v-if="isCompactingActive"
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
              <span>{{ isCompactingActive ? "Compacting…" : "Compact" }}</span>
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

          <AttachMenu
            :disabled="isStreaming"
            :is-linking="isLinking"
            @files="handleFiles($event)"
            @pick-file="pickContext(false)"
            @pick-folder="pickContext(true)"
          />
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
            ref="modelSelectorRef"
            :activeModelName="activeModelName"
            :isActiveModelPulling="isActiveModelPulling"
            @select="selectModel"
            @pull="selectLibraryModel"
          />

          <!-- Send Button -->
          <button
            data-testid="send-btn"
            @click="handleSubmit"
            :disabled="
              isCompactingActive ||
              (!isStreaming && !inputContent.trim() && attachments.length === 0)
            "
            :aria-label="isStreaming ? 'Stop generation' : 'Send message'"
            class="w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0 cursor-pointer disabled:opacity-30 ml-1.5"
            :class="
              isStreaming
                ? 'bg-[var(--bg-user-msg)] hover:bg-[var(--bg-active)]'
                : inputContent.trim() || attachments.length > 0
                  ? 'bg-[var(--text)] hover:bg-[var(--text-muted)] scale-105 shadow-sm'
                  : 'bg-[var(--bg-elevated)] border border-[var(--border-strong)]'
            "
          >
            <svg
              v-if="isStreaming"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="currentColor"
              :class="isStreaming ? 'text-[var(--text)]' : ''"
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
                  ? 'var(--bg-base)'
                  : 'var(--text-muted)'
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

  <FolderFilePickerModal
    v-if="pickerContext"
    :show="!!pickerContext"
    :contextId="pickerContext.id"
    :contextName="pickerContext.name"
    :contextPath="pickerContext.path"
    :includedFiles="pickerContext.includedFiles"
    :auto-refresh="pickerContext.autoRefresh ?? false"
    @apply="
      (files, tokens, content) => handlePickerApply(files, tokens, content)
    "
    @detach="handlePickerDetach"
    @close="closeFilePicker"
    @update-auto-refresh="handleAutoRefreshToggle(pickerContext!.id, $event)"
  />
</template>
