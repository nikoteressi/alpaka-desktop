import { ref, watch, nextTick, onUnmounted } from "vue";
import type { Ref, ComputedRef } from "vue";
import {
  useChatStore,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from "../stores/chat";
import { useDraftManager } from "./useDraftManager";
import type { Attachment } from "./useAttachments";
import type { ChatOptions } from "../types/settings";
import type { LinkedContext } from "../types/chat";
import { DRAFT_SAVE_DEBOUNCE_MS } from "../lib/constants";

export interface DraftSyncRefs {
  inputContent: Ref<string>;
  webSearchEnabled: Ref<boolean>;
  thinkEnabled: Ref<boolean>;
  thinkLevel: Ref<"low" | "medium" | "high">;
  chatOptions: Ref<ChatOptions>;
  presetId: Ref<string>;
  attachments: Ref<Attachment[]>;
}

export interface DraftSyncDeps {
  activeConvId: ComputedRef<string | null>;
  activeModelName: ComputedRef<string>;
  linkedContexts: ComputedRef<LinkedContext[]>;
  clearAttachments: () => void;
  applyModelDefaults: (name: string) => Promise<ChatOptions>;
  resetChatOptions: () => void;
  parseChatOptionsJson: (raw: string) => Partial<ChatOptions> | null;
}

export function useDraftSync(state: DraftSyncRefs, deps: DraftSyncDeps) {
  const chatStore = useChatStore();
  const { setDraft, clearDraft } = useDraftManager();

  const isSyncingDraft = ref(false);

  function applyDraft(
    draft: (typeof chatStore.drafts)[string],
    convIdAtLoad: string,
  ) {
    state.inputContent.value = draft.content;
    state.webSearchEnabled.value = draft.webSearchEnabled;
    state.thinkEnabled.value = draft.thinkEnabled;
    state.thinkLevel.value = draft.thinkLevel;
    state.chatOptions.value = draft.chatOptions || {};
    state.presetId.value = draft.presetId ?? "";
    deps.clearAttachments();
    state.attachments.value = draft.attachments.map((a) => {
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
    state.inputContent.value = "";
    deps.clearAttachments();
    state.webSearchEnabled.value = false;
    state.thinkEnabled.value = false;
    state.thinkLevel.value = "medium";
    const conv = chatStore.conversations.find((c) => c.id === convIdAtLoad);
    const savedSettings = conv?.settings_json
      ? deps.parseChatOptionsJson(conv.settings_json)
      : null;
    if (savedSettings && Object.keys(savedSettings).length > 0) {
      state.chatOptions.value = savedSettings as ChatOptions;
      state.presetId.value = "";
      return;
    }
    const modelName = deps.activeModelName.value;
    if (!modelName || modelName === "Select model") {
      deps.resetChatOptions();
      return;
    }
    try {
      const defaults = await deps.applyModelDefaults(modelName);
      if (deps.activeConvId.value !== convIdAtLoad) return;
      if (Object.keys(defaults).length > 0) {
        state.chatOptions.value = defaults;
        state.presetId.value = "";
      } else {
        deps.resetChatOptions();
      }
    } catch {
      deps.resetChatOptions();
    }
  }

  async function loadDraft() {
    if (!deps.activeConvId.value) return;
    const convIdAtLoad = deps.activeConvId.value;
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
    if (!deps.activeConvId.value || isSyncingDraft.value) return;

    const draftAttachments = state.attachments.value
      .filter((a): a is typeof a & { data: Uint8Array } => a.data !== null)
      .map((a) => ({
        name: a.file.name,
        type: a.file.type,
        data: uint8ArrayToBase64(a.data),
      }));

    setDraft(deps.activeConvId.value, {
      content: state.inputContent.value,
      attachments: draftAttachments,
      linkedContexts: deps.linkedContexts.value,
      webSearchEnabled: state.webSearchEnabled.value,
      thinkEnabled: state.thinkEnabled.value,
      thinkLevel: state.thinkLevel.value,
      chatOptions: state.chatOptions.value,
      presetId: state.presetId.value,
    });
  }

  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function debouncedSaveDraft() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      saveDraft();
      draftSaveTimer = null;
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }

  watch(
    [
      state.inputContent,
      state.webSearchEnabled,
      state.thinkEnabled,
      state.thinkLevel,
      state.chatOptions,
      state.presetId,
    ],
    () => {
      debouncedSaveDraft();
    },
    { deep: true },
  );

  watch(
    [
      () => state.attachments.value.length,
      () => deps.linkedContexts.value.length,
    ],
    () => {
      debouncedSaveDraft();
    },
  );

  watch(
    deps.activeConvId,
    () => {
      loadDraft();
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
  });

  return { isSyncingDraft, clearDraft };
}
