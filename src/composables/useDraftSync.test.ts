import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { ref, computed, nextTick, defineComponent } from "vue";
import { mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

import {
  useDraftSync,
  type DraftSyncRefs,
  type DraftSyncDeps,
} from "./useDraftSync";
import { useChatStore } from "../stores/chat";
import type { ChatOptions } from "../types/settings";

// Helper to build default state/deps for useDraftSync
function makeStateAndDeps(convId: string | null = null) {
  const inputContent = ref("");
  const webSearchEnabled = ref(false);
  const thinkEnabled = ref(false);
  const thinkLevel = ref<"low" | "medium" | "high">("medium");
  const chatOptions = ref<ChatOptions>({});
  const presetId = ref("");
  const attachments = ref<
    { file: File; previewUrl: string; data: Uint8Array | null }[]
  >([]);

  const state: DraftSyncRefs = {
    inputContent,
    webSearchEnabled,
    thinkEnabled,
    thinkLevel,
    chatOptions,
    presetId,
    attachments,
  };

  const clearAttachments = vi.fn(() => {
    attachments.value = [];
  });
  const applyModelDefaults = vi.fn().mockResolvedValue({});
  const resetChatOptions = vi.fn();
  const parseChatOptionsJson = vi.fn().mockReturnValue(null);

  const activeConvId = computed(() => convId);
  const activeModelName = computed(() => "llama3");
  const linkedContexts = computed(() => []);

  const deps: DraftSyncDeps = {
    activeConvId,
    activeModelName,
    linkedContexts,
    clearAttachments,
    applyModelDefaults,
    resetChatOptions,
    parseChatOptionsJson,
  };

  return {
    state,
    deps,
    inputContent,
    webSearchEnabled,
    thinkEnabled,
    thinkLevel,
    chatOptions,
    presetId,
    attachments,
    clearAttachments,
    applyModelDefaults,
    resetChatOptions,
    parseChatOptionsJson,
  };
}

// Mount a wrapper component so lifecycle hooks (onUnmounted, watch) work correctly
function mountWithDraftSync(state: DraftSyncRefs, deps: DraftSyncDeps) {
  let syncResult: ReturnType<typeof useDraftSync> | null = null;
  const wrapper = mount(
    defineComponent({
      setup() {
        syncResult = useDraftSync(state, deps);
        return syncResult;
      },
      template: "<div></div>",
    }),
  );
  return {
    wrapper,
    get syncResult() {
      return syncResult!;
    },
  };
}

describe("useDraftSync", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isSyncingDraft starts as false", async () => {
    const { state, deps } = makeStateAndDeps(null);
    const { syncResult } = mountWithDraftSync(state, deps);
    expect(syncResult.isSyncingDraft.value).toBe(false);
  });

  it("loadDraft is a no-op when activeConvId is null", async () => {
    const { state, deps, applyModelDefaults } = makeStateAndDeps(null);
    mountWithDraftSync(state, deps);
    await nextTick();
    expect(applyModelDefaults).not.toHaveBeenCalled();
  });

  it("loadDraft applies stored draft when present", async () => {
    const store = useChatStore();
    store.drafts["conv-1"] = {
      content: "hello draft",
      attachments: [],
      linkedContexts: [],
      webSearchEnabled: true,
      thinkEnabled: false,
      thinkLevel: "high",
      chatOptions: { temperature: 0.5 },
      presetId: "p1",
    };

    const {
      state,
      deps,
      inputContent,
      webSearchEnabled,
      thinkLevel,
      presetId,
    } = makeStateAndDeps("conv-1");
    mountWithDraftSync(state, deps);
    await nextTick();
    await nextTick();

    expect(inputContent.value).toBe("hello draft");
    expect(webSearchEnabled.value).toBe(true);
    expect(thinkLevel.value).toBe("high");
    expect(presetId.value).toBe("p1");
  });

  it("applyDraft handles attachments by base64 decoding", async () => {
    const store = useChatStore();
    // Use valid base64 for a 1-byte 0x00 value
    const base64Data = btoa("\x00\x01\x02");
    store.drafts["conv-attach"] = {
      content: "text",
      attachments: [{ name: "file.txt", type: "text/plain", data: base64Data }],
      linkedContexts: [],
      webSearchEnabled: false,
      thinkEnabled: false,
      thinkLevel: "medium",
      chatOptions: {},
      presetId: "",
    };

    const { state, deps, attachments } = makeStateAndDeps("conv-attach");
    mountWithDraftSync(state, deps);
    await nextTick();
    await nextTick();

    expect(attachments.value).toHaveLength(1);
    expect(attachments.value[0].file.name).toBe("file.txt");
  });

  it("applyDraft restores linkedContexts into chatStore.folderContexts", async () => {
    const store = useChatStore();
    store.drafts["conv-ctx"] = {
      content: "",
      attachments: [],
      linkedContexts: [
        {
          id: "lc1",
          name: "folder",
          path: "/docs",
          content: "body",
          tokens: 100,
        },
      ],
      webSearchEnabled: false,
      thinkEnabled: false,
      thinkLevel: "medium",
      chatOptions: {},
      presetId: "",
    };

    const { state, deps } = makeStateAndDeps("conv-ctx");
    mountWithDraftSync(state, deps);
    await nextTick();
    await nextTick();

    expect(store.folderContexts["conv-ctx"]).toHaveLength(1);
  });

  it("applyNoDraftSettings uses savedSettings from conv.settings_json when present", async () => {
    const store = useChatStore();
    store.conversations = [
      {
        id: "conv-saved",
        title: "T",
        model: "llama3",
        settings_json: '{"temperature":0.9}',
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
    ];

    const { state, deps, chatOptions, parseChatOptionsJson } =
      makeStateAndDeps("conv-saved");
    parseChatOptionsJson.mockReturnValue({ temperature: 0.9 });

    mountWithDraftSync(state, deps);
    await nextTick();
    await nextTick();
    await nextTick();

    expect(parseChatOptionsJson).toHaveBeenCalledWith('{"temperature":0.9}');
    expect(chatOptions.value).toEqual({ temperature: 0.9 });
  });

  it("applyNoDraftSettings falls back to resetChatOptions when no model", async () => {
    const store = useChatStore();
    store.conversations = [
      {
        id: "conv-nomodel",
        title: "T",
        model: "",
        settings_json: "{}",
        pinned: false,
        tags: [],
        draft_json: null,
        created_at: "",
        updated_at: "",
      },
    ];

    const { state, deps, resetChatOptions } = makeStateAndDeps("conv-nomodel");
    // Override activeModelName to simulate no model selected
    const deps2: DraftSyncDeps = {
      ...deps,
      activeModelName: computed(() => "Select model"),
    };

    mountWithDraftSync(state, deps2);
    await nextTick();
    await nextTick();
    await nextTick();

    expect(resetChatOptions).toHaveBeenCalled();
  });

  it("applyNoDraftSettings applies model defaults when available", async () => {
    const { state, deps, chatOptions, applyModelDefaults } =
      makeStateAndDeps("conv-defaults");
    applyModelDefaults.mockResolvedValue({ temperature: 0.3 });

    mountWithDraftSync(state, deps);
    await nextTick();
    await nextTick();
    await nextTick();

    expect(applyModelDefaults).toHaveBeenCalledWith("llama3");
    expect(chatOptions.value).toEqual({ temperature: 0.3 });
  });

  it("applyNoDraftSettings calls resetChatOptions when model defaults are empty", async () => {
    const { state, deps, resetChatOptions, applyModelDefaults } =
      makeStateAndDeps("conv-empty-defaults");
    applyModelDefaults.mockResolvedValue({});

    mountWithDraftSync(state, deps);
    await nextTick();
    await nextTick();
    await nextTick();

    expect(resetChatOptions).toHaveBeenCalled();
  });

  it("applyNoDraftSettings calls resetChatOptions when applyModelDefaults throws", async () => {
    const { state, deps, resetChatOptions, applyModelDefaults } =
      makeStateAndDeps("conv-throw");
    applyModelDefaults.mockRejectedValue(new Error("network"));

    mountWithDraftSync(state, deps);
    await nextTick();
    await nextTick();
    await nextTick();
    await nextTick();

    expect(resetChatOptions).toHaveBeenCalled();
  });

  it("saveDraft is skipped while isSyncingDraft is true", async () => {
    const store = useChatStore();
    vi.useFakeTimers();

    const { state, deps } = makeStateAndDeps("conv-nosave");
    const { syncResult } = mountWithDraftSync(state, deps);

    // Force isSyncingDraft = true before triggering a watch
    syncResult.isSyncingDraft.value = true;
    state.inputContent.value = "changed";

    vi.advanceTimersByTime(600);
    await nextTick();

    expect(store.drafts["conv-nosave"]).toBeUndefined();
  });

  it("debouncedSaveDraft fires after DRAFT_SAVE_DEBOUNCE_MS and stores the draft", async () => {
    vi.useFakeTimers();

    const { state, deps } = makeStateAndDeps("conv-debounce");
    mountWithDraftSync(state, deps);

    // Flush all pending microtasks and timers from initial loadDraft
    await vi.runAllTimersAsync();
    await nextTick();
    await nextTick();

    // Trigger the debounced watcher
    state.inputContent.value = "debounced content";
    await nextTick(); // let watcher fire

    // Advance past debounce interval
    await vi.advanceTimersByTimeAsync(600);
    await nextTick();

    const store = useChatStore();
    // setDraft is called which updates store.drafts
    expect(store.drafts["conv-debounce"]?.content).toBe("debounced content");
  });

  it("clears debounce timer on unmount", async () => {
    vi.useFakeTimers();
    const { state, deps } = makeStateAndDeps("conv-unmount");
    const { wrapper } = mountWithDraftSync(state, deps);

    state.inputContent.value = "pending";
    // Unmount before the timer fires
    wrapper.unmount();

    // Should not throw even if timer would have fired
    vi.advanceTimersByTime(600);
  });

  it("clearDraft removes the draft entry from store", async () => {
    const store = useChatStore();
    store.drafts["conv-clr2"] = {
      content: "old",
      attachments: [],
      linkedContexts: [],
      webSearchEnabled: false,
      thinkEnabled: false,
      thinkLevel: "medium",
      chatOptions: {},
      presetId: "",
    };

    const { state, deps } = makeStateAndDeps("conv-clr2");
    const { syncResult } = mountWithDraftSync(state, deps);

    await syncResult.clearDraft("conv-clr2");
    expect(store.drafts["conv-clr2"]).toBeUndefined();
  });
});
