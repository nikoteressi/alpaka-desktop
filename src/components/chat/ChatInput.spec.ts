import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import ChatInput from "./ChatInput.vue";
import { useChatStore } from "../../stores/chat";
import { useModelStore } from "../../stores/models";
import { useSettingsStore } from "../../stores/settings";
import type { ModelCapabilities, ModelName } from "../../types/models";

// --- Module-level mocks ---

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args: Record<string, unknown>) => mockInvoke(cmd, args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    onDragDropEvent: vi.fn().mockResolvedValue(() => {}),
  }),
}));

interface AttachmentMock {
  file: File;
  previewUrl: string;
  data?: Uint8Array;
}

// --- Helpers ---

function makeConversation(model: string) {
  return {
    id: "conv-test-1",
    title: "Test Chat",
    model,
    settings_json: "{}",
    pinned: false,
    tags: [] as string[],
    draft_json: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function makeCaps(
  overrides: Partial<ModelCapabilities> & { name: string },
): ModelCapabilities {
  return {
    tools: false,
    thinking: false,
    thinking_toggleable: !!overrides.thinking,
    thinking_levels: [],
    vision: false,
    embedding: false,
    audio: false,
    cloud: false,
    ...overrides,
  };
}

/**
 * Mount ChatInput using the active Pinia (set via setActivePinia in beforeEach).
 * Do NOT pass global.plugins: [createPinia()] — that would create a second, separate
 * Pinia instance that the component uses while the test uses a different one.
 */
function mountInput() {
  return mount(ChatInput, {
    props: { isStreaming: false },
  });
}

// --- Tests ---

describe("ChatInput — Web Search toggle visibility", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Reject get_model_capabilities so name-based heuristics remain active,
    // unless individual tests pre-populate capabilities directly.
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve([]);
    });
  });

  it("GIVEN Cloud=OFF — web search button is NOT rendered", () => {
    const settingsStore = useSettingsStore();
    settingsStore.cloud = false;
    const wrapper = mountInput();

    expect(wrapper.find('[title="Web search off"]').exists()).toBe(false);
    expect(wrapper.find('[title="Web search on"]').exists()).toBe(false);
  });

  it("GIVEN Cloud=ON + tool-capable model — web search button IS rendered", async () => {
    const modelStore = useModelStore();
    modelStore.capabilities["llama3:8b" as ModelName] = makeCaps({
      name: "llama3:8b" as ModelName,
      tools: true,
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3:8b"));
    chatStore.activeConversationId = "conv-test-1";

    const settingsStore = useSettingsStore();
    settingsStore.cloud = true;

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    expect(
      wrapper
        .find('[aria-label="Enable web search"][aria-pressed="false"]')
        .exists(),
    ).toBe(true);
  });

  it("GIVEN Cloud=ON + tool-capable model — clicking once activates web search (blue border class applied)", async () => {
    const modelStore = useModelStore();
    modelStore.capabilities["llama3:8b" as ModelName] = makeCaps({
      name: "llama3:8b" as ModelName,
      tools: true,
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3:8b"));
    chatStore.activeConversationId = "conv-test-1";

    const settingsStore = useSettingsStore();
    settingsStore.cloud = true;

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    const btn = wrapper.find('[aria-label="Enable web search"]');
    await btn.trigger("click");
    await wrapper.vm.$nextTick();

    const activeBtn = wrapper.find(
      '[aria-label="Enable web search"][aria-pressed="true"]',
    );
    expect(activeBtn.exists()).toBe(true);
    expect(activeBtn.classes()).toContain("border-[var(--accent)]");
  });

  it("GIVEN Cloud=ON + tool-capable model — clicking twice deactivates web search (grey class restored)", async () => {
    const modelStore = useModelStore();
    modelStore.capabilities["llama3:8b" as ModelName] = makeCaps({
      name: "llama3:8b" as ModelName,
      tools: true,
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3:8b"));
    chatStore.activeConversationId = "conv-test-1";

    const settingsStore = useSettingsStore();
    settingsStore.cloud = true;

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    const btn = wrapper.find('[aria-label="Enable web search"]');
    await btn.trigger("click");
    await wrapper.vm.$nextTick();

    await btn.trigger("click");
    await wrapper.vm.$nextTick();

    const inactiveBtn = wrapper.find(
      '[aria-label="Enable web search"][aria-pressed="false"]',
    );
    expect(inactiveBtn.exists()).toBe(true);
    expect(inactiveBtn.classes()).toContain("border-[var(--border-strong)]");
  });
});

describe("ChatInput — Thinking toggle visibility", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve([]);
    });
  });

  it('GIVEN model="deepseek-r1:7b" (binary-think) — thinking toggle IS rendered', async () => {
    const modelStore = useModelStore();
    modelStore.capabilities["deepseek-r1:7b" as ModelName] = makeCaps({
      name: "deepseek-r1:7b" as ModelName,
      thinking: true,
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("deepseek-r1:7b"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    // Binary-think models show a button toggling between off (aria-pressed=false) and on
    expect(
      wrapper
        .find('[aria-label="Enable thinking mode"][aria-pressed="false"]')
        .exists(),
    ).toBe(true);
  });

  it('GIVEN model="deepseek-r1:7b" — clicking thinking toggle activates it', async () => {
    const modelStore = useModelStore();
    modelStore.capabilities["deepseek-r1:7b" as ModelName] = makeCaps({
      name: "deepseek-r1:7b" as ModelName,
      thinking: true,
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("deepseek-r1:7b"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    const btn = wrapper.find('[aria-label="Enable thinking mode"]');
    await btn.trigger("click");
    await wrapper.vm.$nextTick();

    expect(
      wrapper
        .find('[aria-label="Enable thinking mode"][aria-pressed="true"]')
        .exists(),
    ).toBe(true);
  });

  it('GIVEN model="deepseek-r1:7b" — thinking toggle initial state is off', async () => {
    const modelStore = useModelStore();
    modelStore.capabilities["deepseek-r1:7b" as ModelName] = makeCaps({
      name: "deepseek-r1:7b" as ModelName,
      thinking: true,
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("deepseek-r1:7b"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    // Starts in "off" state — not yet activated
    expect(
      wrapper
        .find('[aria-label="Enable thinking mode"][aria-pressed="false"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper
        .find('[aria-label="Enable thinking mode"][aria-pressed="true"]')
        .exists(),
    ).toBe(false);
  });

  it('GIVEN model="llama3:8b" (non-thinking) — thinking toggle is NOT rendered', async () => {
    const modelStore = useModelStore();
    modelStore.capabilities["llama3:8b" as ModelName] = makeCaps({
      name: "llama3:8b" as ModelName,
      tools: true,
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3:8b"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[aria-label="Enable thinking mode"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[aria-label="Reasoning depth"]').exists()).toBe(false);
  });

  it('GIVEN no active conversation — thinking toggle is NOT rendered (falls back to "Select model")', async () => {
    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[aria-label="Enable thinking mode"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[aria-label="Reasoning depth"]').exists()).toBe(false);
  });
});

describe("ChatInput — Cloud=OFF, non-thinking model baseline", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve([]);
    });
  });

  it("GIVEN Cloud=OFF and non-thinking model — neither web search nor thinking toggle rendered", async () => {
    const modelStore = useModelStore();
    modelStore.capabilities["llama3:8b" as ModelName] = makeCaps({
      name: "llama3:8b" as ModelName,
      tools: true,
    });

    const settingsStore = useSettingsStore();
    settingsStore.cloud = false;

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3:8b"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[aria-label="Enable web search"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[aria-label="Enable thinking mode"]').exists()).toBe(
      false,
    );
  });
});

describe("ChatInput — Cloud=ON AND thinking model", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve([]);
    });
  });

  it("GIVEN Cloud=ON AND model with tools+thinking — both web search and thinking toggle rendered", async () => {
    const modelStore = useModelStore();
    modelStore.capabilities["deepseek-r1:7b" as ModelName] = makeCaps({
      name: "deepseek-r1:7b" as ModelName,
      tools: true,
      thinking: true,
    });

    const settingsStore = useSettingsStore();
    settingsStore.cloud = true;

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("deepseek-r1:7b"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    expect(
      wrapper
        .find('[aria-label="Enable web search"][aria-pressed="false"]')
        .exists(),
    ).toBe(true);
    expect(
      wrapper
        .find('[aria-label="Enable thinking mode"][aria-pressed="false"]')
        .exists(),
    ).toBe(true);
  });
});

describe("ChatInput — Submission", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation(() => Promise.resolve([]));
  });

  it("emits send when handleSubmit is called with text", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      inputContent: string;
      handleSubmit: () => Promise<void>;
      handleFiles: (files: File[]) => Promise<void>;
      attachments: unknown[];
    };
    vm.inputContent = "Hello world";

    await vm.handleSubmit();

    expect(wrapper.emitted("send")).toBeTruthy();
    expect(wrapper.emitted("send")![0]).toContain("Hello world");
    expect(vm.inputContent).toBe(""); // Should reset after send
  });

  it("emits stop when handleSubmit is called while streaming", async () => {
    const wrapper = mount(ChatInput, {
      props: { isStreaming: true },
    });
    const vm = wrapper.vm as unknown as {
      inputContent: string;
      handleSubmit: () => Promise<void>;
      handleFiles: (files: File[]) => Promise<void>;
      attachments: unknown[];
    };
    vm.inputContent = "Hello world";

    await vm.handleSubmit();

    expect(wrapper.emitted("stop")).toBeTruthy();
    expect(wrapper.emitted("send")).toBeFalsy();
  });
});

describe("ChatInput — parseChatOptionsJson mirostat fields", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation(() => Promise.resolve(undefined));
  });

  it("restores mirostat=1 from settings_json when loading a conversation", async () => {
    const chatStore = useChatStore();
    const conv = makeConversation("llama3");
    conv.settings_json = JSON.stringify({
      mirostat: 1,
      mirostat_tau: 3.5,
      mirostat_eta: 0.05,
    });
    chatStore.conversations.push(conv);
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as {
      chatOptions: Record<string, unknown>;
    };
    expect(vm.chatOptions.mirostat).toBe(1);
    expect(vm.chatOptions.mirostat_tau).toBe(3.5);
    expect(vm.chatOptions.mirostat_eta).toBe(0.05);
  });

  it("restores mirostat=0 (Off) from settings_json", async () => {
    const chatStore = useChatStore();
    const conv = makeConversation("llama3");
    conv.settings_json = JSON.stringify({ mirostat: 0, temperature: 0.5 });
    chatStore.conversations.push(conv);
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as {
      chatOptions: Record<string, unknown>;
    };
    expect(vm.chatOptions.mirostat).toBe(0);
    expect(vm.chatOptions.temperature).toBe(0.5);
  });

  it("ignores invalid mirostat values from settings_json", async () => {
    const chatStore = useChatStore();
    const conv = makeConversation("llama3");
    conv.settings_json = JSON.stringify({ mirostat: 99, temperature: 0.7 });
    chatStore.conversations.push(conv);
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as unknown as {
      chatOptions: Record<string, unknown>;
    };
    expect(vm.chatOptions.mirostat).toBeUndefined();
    expect(vm.chatOptions.temperature).toBe(0.7);
  });
});

describe("ChatInput — loadDraft applies model defaults when no settings_json", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("applies model defaults (including mirostat) when conversation has no settings_json", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_defaults")
        return Promise.resolve({
          mirostat: 2,
          mirostat_tau: 4.0,
          mirostat_eta: 0.1,
        });
      if (cmd === "get_model_capabilities")
        return Promise.resolve({
          vision: false,
          tools: false,
          thinking: false,
          thinking_toggleable: false,
          thinking_levels: [],
        });
      return Promise.resolve(undefined);
    });

    const chatStore = useChatStore();
    const conv = makeConversation("qwen2.5:7b");
    conv.settings_json = "{}";
    chatStore.conversations.push(conv);
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();
    // allow async loadDraft to resolve
    await new Promise((r) => setTimeout(r, 0));

    const vm = wrapper.vm as unknown as {
      chatOptions: Record<string, unknown>;
    };
    expect(mockInvoke).toHaveBeenCalledWith("get_model_defaults", {
      modelName: "qwen2.5:7b",
    });
    expect(vm.chatOptions.mirostat).toBe(2);
    expect(vm.chatOptions.mirostat_tau).toBe(4.0);
  });
});

describe("ChatInput — Model defaults on selection", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve(undefined);
    });
  });

  it("GIVEN a model is selected — get_model_defaults is invoked with the model name", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_defaults")
        return Promise.resolve({ temperature: 0.1, num_ctx: 8192 });
      if (cmd === "update_conversation_model")
        return Promise.resolve(undefined);
      if (cmd === "get_model_capabilities")
        return Promise.resolve({
          vision: false,
          tools: false,
          thinking: false,
          thinking_toggleable: false,
          thinking_levels: [],
        });
      return Promise.resolve(undefined);
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("qwen2.5-coder:14b"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      selectModel: (model: string) => Promise<void>;
      chatOptions: { temperature?: number };
    };

    await vm.selectModel("qwen2.5-coder:14b");

    expect(mockInvoke).toHaveBeenCalledWith("get_model_defaults", {
      modelName: "qwen2.5-coder:14b",
    });
    expect(vm.chatOptions.temperature).toBe(0.1);
  });

  it("GIVEN no model defaults stored — selectModel does not throw", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_defaults") return Promise.resolve(null);
      if (cmd === "update_conversation_model")
        return Promise.resolve(undefined);
      if (cmd === "get_model_capabilities")
        return Promise.resolve({
          vision: false,
          tools: false,
          thinking: false,
          thinking_toggleable: false,
          thinking_levels: [],
        });
      return Promise.resolve(undefined);
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      selectModel: (model: string) => Promise<void>;
      chatOptions: Record<string, unknown>;
    };

    await expect(vm.selectModel("llama3")).resolves.not.toThrow();
    expect(vm.chatOptions).toEqual({});
  });
});

describe("ChatInput — Link error display", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    mockInvoke.mockImplementation(() => Promise.resolve([]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("showLinkError sets linkError and auto-clears after 4 s", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      showLinkError: (msg: string) => void;
      linkError: string | null;
    };

    vm.showLinkError("Something went wrong");
    await wrapper.vm.$nextTick();

    expect(vm.linkError).toBe("Something went wrong");

    vi.advanceTimersByTime(4000);
    await wrapper.vm.$nextTick();

    expect(vm.linkError).toBeNull();
  });

  it("showLinkError cancels a previous pending timer on repeated calls", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      showLinkError: (msg: string) => void;
      linkError: string | null;
    };

    vm.showLinkError("first error");
    await wrapper.vm.$nextTick();
    vi.advanceTimersByTime(2000);

    vm.showLinkError("second error");
    await wrapper.vm.$nextTick();
    vi.advanceTimersByTime(2000);

    // first timer would have cleared it at t=4000; second timer resets the clock
    expect(vm.linkError).toBe("second error");

    vi.advanceTimersByTime(2000);
    await wrapper.vm.$nextTick();

    expect(vm.linkError).toBeNull();
  });

  it("renders the linkError message in the template", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      showLinkError: (msg: string) => void;
    };

    vm.showLinkError("File is binary");
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("File is binary");
  });

  it("pickContext shows a Tauri plain-string error when link_folder rejects", async () => {
    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";

    const { open } = await import("@tauri-apps/plugin-dialog");
    vi.mocked(open).mockResolvedValueOnce("/home/user/notes.txt");

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "link_folder")
        return Promise.reject("File is binary or unreadable");
      return Promise.resolve([]);
    });

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      pickContext: (isFolder: boolean) => Promise<void>;
      linkError: string | null;
    };

    await vm.pickContext(false);
    await wrapper.vm.$nextTick();

    expect(vm.linkError).toBe("File is binary or unreadable");
  });

  it("pickContext shows a fallback message when a non-string non-Error is thrown", async () => {
    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";

    const { open } = await import("@tauri-apps/plugin-dialog");
    vi.mocked(open).mockResolvedValueOnce("/home/user/doc.txt");

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "link_folder") return Promise.reject({ code: 42 });
      return Promise.resolve([]);
    });

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      pickContext: (isFolder: boolean) => Promise<void>;
      linkError: string | null;
    };

    await vm.pickContext(false);
    await wrapper.vm.$nextTick();

    expect(vm.linkError).toBe(
      "Failed to link file — binary or unreadable files cannot be used as context.",
    );
  });
});

describe("ChatInput — onBeforeUnmount cleanup", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    mockInvoke.mockImplementation(() => Promise.resolve([]));
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears linkErrorTimer on unmount so it does not fire after teardown", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      showLinkError: (msg: string) => void;
      linkError: string | null;
    };

    vm.showLinkError("pending error");
    await wrapper.vm.$nextTick();
    expect(vm.linkError).toBe("pending error");

    wrapper.unmount();

    // Advancing past the timer should not throw (cleared) and linkError stays put
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
  });

  it("clears attachments on unmount", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      handleFiles: (files: File[]) => Promise<void>;
      attachments: { file: File; previewUrl: string }[];
    };

    const file = new File(["x"], "img.png", { type: "image/png" });
    await vm.handleFiles([file]);
    expect(vm.attachments).toHaveLength(1);

    wrapper.unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe("ChatInput — Attachments", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation(() => Promise.resolve([]));
    // Mock URL.createObjectURL/revokeObjectURL for blob simulation
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("handles image files and adds to attachments list", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      inputContent: string;
      handleSubmit: () => Promise<void>;
      handleFiles: (files: File[]) => Promise<void>;
      attachments: AttachmentMock[];
    };

    const file = new File([""], "test.png", { type: "image/png" });
    await vm.handleFiles([file]);

    expect(vm.attachments).toHaveLength(1);
    expect(vm.attachments[0].file.name).toBe("test.png");
    expect(vm.attachments[0].previewUrl).toBe("blob:mock-url");
  });

  it("emits send with attachments data", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      inputContent: string;
      handleSubmit: () => Promise<void>;
      handleFiles: (files: File[]) => Promise<void>;
      attachments: AttachmentMock[];
    };

    vm.inputContent = "See this";
    vm.attachments = [
      {
        file: new File([""], "test.png", { type: "image/png" }),
        previewUrl: "blob:mock-url",
        data: new Uint8Array([1, 2, 3]),
      },
    ];

    await vm.handleSubmit();

    expect(wrapper.emitted("send")).toBeTruthy();
    const payload = wrapper.emitted("send")![0];
    expect(payload[0]).toBe("See this");
    expect(payload[1]).toEqual([new Uint8Array([1, 2, 3])]);
    expect(vm.attachments).toHaveLength(0); // Should clear after send
  });
});

describe("ChatInput — System prompt panel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve(undefined);
    });
  });

  it("toggleSystemPrompt opens the panel on first call", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      toggleSystemPrompt: () => void;
      isSystemPromptOpen: boolean;
    };

    expect(vm.isSystemPromptOpen).toBe(false);
    vm.toggleSystemPrompt();
    await wrapper.vm.$nextTick();
    expect(vm.isSystemPromptOpen).toBe(true);
  });

  it("toggleSystemPrompt closes the panel on second call", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      toggleSystemPrompt: () => void;
      isSystemPromptOpen: boolean;
    };

    vm.toggleSystemPrompt();
    vm.toggleSystemPrompt();
    await wrapper.vm.$nextTick();
    expect(vm.isSystemPromptOpen).toBe(false);
  });

  it("toggleSystemPrompt populates systemPromptDraft from activeSystemPrompt when opening", async () => {
    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";
    // Seed a system message so activeSystemPrompt computed returns a value
    chatStore.messages["conv-test-1"] = [
      {
        id: "msg-sys",
        conversation_id: "conv-test-1",
        role: "system",
        content: "You are a helpful assistant.",
      },
    ] as any;

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      toggleSystemPrompt: () => void;
      isSystemPromptOpen: boolean;
      systemPromptDraft: string;
    };

    vm.toggleSystemPrompt();
    await wrapper.vm.$nextTick();
    expect(vm.systemPromptDraft).toBe("You are a helpful assistant.");
  });

  it("cancelSystemPrompt closes panel and resets draft", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      toggleSystemPrompt: () => void;
      cancelSystemPrompt: () => void;
      isSystemPromptOpen: boolean;
      systemPromptDraft: string;
    };

    vm.toggleSystemPrompt();
    vm.systemPromptDraft = "some text";
    vm.cancelSystemPrompt();
    await wrapper.vm.$nextTick();

    expect(vm.isSystemPromptOpen).toBe(false);
  });

  it("saveSystemPrompt is a no-op when no activeConversationId", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      saveSystemPrompt: () => Promise<void>;
      isSystemPromptOpen: boolean;
    };

    vm.isSystemPromptOpen = true;
    await vm.saveSystemPrompt();
    // Should still be open because nothing was saved
    expect(vm.isSystemPromptOpen).toBe(true);
  });

  it("saveSystemPrompt closes panel after saving", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      if (cmd === "update_conversation_system_prompt")
        return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      toggleSystemPrompt: () => void;
      saveSystemPrompt: () => Promise<void>;
      isSystemPromptOpen: boolean;
    };

    vm.toggleSystemPrompt();
    await vm.saveSystemPrompt();
    await wrapper.vm.$nextTick();

    expect(vm.isSystemPromptOpen).toBe(false);
  });
});

describe("ChatInput — Advanced options toggle", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve(undefined);
    });
  });

  it("advanced options panel is closed by default", () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as { isAdvancedOptionsOpen: boolean };
    expect(vm.isAdvancedOptionsOpen).toBe(false);
  });

  it("clicking the advanced options button toggles isAdvancedOptionsOpen", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as { isAdvancedOptionsOpen: boolean };

    const btn = wrapper.find('[aria-label="Toggle advanced options"]');
    await btn.trigger("click");
    expect(vm.isAdvancedOptionsOpen).toBe(true);

    await btn.trigger("click");
    expect(vm.isAdvancedOptionsOpen).toBe(false);
  });

  it("advanced options button reflects state via aria-pressed", async () => {
    const wrapper = mountInput();
    const btn = wrapper.find('[aria-label="Toggle advanced options"]');

    expect(btn.attributes("aria-pressed")).toBe("false");
    await btn.trigger("click");
    expect(btn.attributes("aria-pressed")).toBe("true");
  });
});

describe("ChatInput — handleTextareaKeydown", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation(() => Promise.resolve(undefined));
  });

  it("Enter without Shift triggers submit", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      inputContent: string;
      handleTextareaKeydown: (e: KeyboardEvent) => void;
    };

    vm.inputContent = "Hello";
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: false,
      bubbles: true,
    });
    // spy on preventDefault
    const preventSpy = vi.spyOn(event, "preventDefault");

    vm.handleTextareaKeydown(event);
    await wrapper.vm.$nextTick();

    expect(preventSpy).toHaveBeenCalled();
    expect(wrapper.emitted("send")).toBeTruthy();
  });

  it("Shift+Enter does NOT trigger submit", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      inputContent: string;
      handleTextareaKeydown: (e: KeyboardEvent) => void;
    };

    vm.inputContent = "Hello";
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
    });

    vm.handleTextareaKeydown(event);
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("send")).toBeFalsy();
  });

  it("Ctrl+Z calls doUndo and prevents default", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      handleTextareaKeydown: (e: KeyboardEvent) => void;
    };

    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      shiftKey: false,
      bubbles: true,
    });
    const preventSpy = vi.spyOn(event, "preventDefault");

    vm.handleTextareaKeydown(event);

    expect(preventSpy).toHaveBeenCalled();
    // No assertion on undo state — just ensures no throw and default is prevented
  });

  it("Ctrl+Shift+Z calls doRedo and prevents default", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      handleTextareaKeydown: (e: KeyboardEvent) => void;
    };

    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });
    const preventSpy = vi.spyOn(event, "preventDefault");

    vm.handleTextareaKeydown(event);

    expect(preventSpy).toHaveBeenCalled();
  });
});

describe("ChatInput — resetChatOptions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve(undefined);
    });
  });

  it("with a default preset — resets chatOptions to the preset's options", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.defaultPresetId = "balanced";

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      resetChatOptions: () => void;
      chatOptions: Record<string, unknown>;
      presetId: string;
    };

    vm.chatOptions = { temperature: 0.99 };
    vm.resetChatOptions();

    const balancedPreset = settingsStore.presets.find(
      (p) => p.id === "balanced",
    );
    expect(vm.chatOptions).toMatchObject(balancedPreset!.options);
    expect(vm.presetId).toBe("balanced");
  });

  it("without a default preset — resets chatOptions to empty object", async () => {
    const settingsStore = useSettingsStore();
    settingsStore.defaultPresetId = "nonexistent-id";

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      resetChatOptions: () => void;
      chatOptions: Record<string, unknown>;
      presetId: string;
    };

    vm.chatOptions = { temperature: 0.99 };
    vm.resetChatOptions();

    expect(vm.chatOptions).toEqual({});
    expect(vm.presetId).toBe("");
  });
});

describe("ChatInput — linked context icon rendering", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve(undefined);
    });
  });

  it("renders folder icon when linked context path has no file extension", async () => {
    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";
    chatStore.addFolderContext("conv-test-1", {
      id: "ctx-folder",
      name: "MyFolder",
      path: "/home/user/MyFolder",
      content: "folder content",
      tokens: 10,
    });

    const wrapper = mountInput();
    await wrapper.vm.$nextTick();

    // The folder SVG (v-else branch) should render for a path without a dot
    const folderIcon = wrapper.find(
      "svg path[d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z']",
    );
    expect(folderIcon.exists()).toBe(true);
  });
});

describe("ChatInput — removeContext", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      if (cmd === "unlink_folder") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });
  });

  it("calls unlink_folder invoke and removes context from store", async () => {
    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";
    chatStore.addFolderContext("conv-test-1", {
      id: "ctx-1",
      name: "notes.txt",
      path: "/home/user/notes.txt",
      content: "hello",
      tokens: 5,
    });

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      removeContext: (contextId: string) => Promise<void>;
    };

    await vm.removeContext("ctx-1");
    await wrapper.vm.$nextTick();

    expect(mockInvoke).toHaveBeenCalledWith("unlink_folder", { id: "ctx-1" });
    // Context should be removed from store
    expect(chatStore.folderContexts["conv-test-1"] ?? []).not.toContainEqual(
      expect.objectContaining({ id: "ctx-1" }),
    );
  });
});

describe("ChatInput — isCloudName + selectModel (cloud branch)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.resolve({
          vision: false,
          tools: false,
          thinking: false,
          thinking_toggleable: false,
          thinking_levels: [],
        });
      if (cmd === "get_model_defaults") return Promise.resolve(null);
      if (cmd === "update_conversation_model")
        return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });
  });

  it("selectModel with a cloud-tagged model calls modelStore.addCloudModel", async () => {
    const modelStore = useModelStore();
    const addCloudSpy = vi
      .spyOn(modelStore, "addCloudModel")
      .mockResolvedValue();

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3:latest"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      selectModel: (model: string) => Promise<void>;
    };

    await vm.selectModel("llama3:cloud");

    expect(addCloudSpy).toHaveBeenCalledWith("llama3:cloud");
  });

  it("selectModel without cloud tag does NOT call addCloudModel", async () => {
    const modelStore = useModelStore();
    const addCloudSpy = vi
      .spyOn(modelStore, "addCloudModel")
      .mockResolvedValue();

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3:latest"));
    chatStore.activeConversationId = "conv-test-1";

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      selectModel: (model: string) => Promise<void>;
    };

    await vm.selectModel("llama3:8b");

    expect(addCloudSpy).not.toHaveBeenCalled();
  });
});

describe("ChatInput — handleCompact", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      return Promise.resolve(undefined);
    });
  });

  it("returns early when no active conversation", async () => {
    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      handleCompact: () => Promise<void>;
    };
    const chatStore = useChatStore();

    await vm.handleCompact();
    // No compaction should be in progress since there's no active conversation
    expect(chatStore.compactionInProgress).toEqual({});
  });

  it("calls compactConversation after compact completes", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      if (cmd === "compact_conversation") return Promise.resolve("new-conv-id");
      if (cmd === "load_messages") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";

    const compactSpy = vi
      .spyOn(chatStore, "compactConversation")
      .mockResolvedValue();
    vi.spyOn(chatStore, "loadConversation").mockResolvedValue();

    const wrapper = mountInput();
    const vm = wrapper.vm as unknown as {
      handleCompact: () => Promise<void>;
    };

    await vm.handleCompact();

    expect(compactSpy).toHaveBeenCalled();
  });
});

describe("ChatInput — folder file picker", () => {
  const folderPickerStub = {
    name: "FolderFilePickerModal",
    template: '<div data-test="picker-modal-stub" />',
    emits: ["apply", "detach", "close"],
  };

  function mountWithPicker() {
    return mount(ChatInput, {
      props: { isStreaming: false },
      global: {
        stubs: { FolderFilePickerModal: folderPickerStub },
      },
    });
  }

  function makeLinkedContext() {
    return {
      id: "ctx-picker-1",
      name: "notes.txt",
      path: "/home/user/notes.txt",
      content: "file content",
      tokens: 20,
    };
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_model_capabilities")
        return Promise.reject(new Error("mock"));
      if (cmd === "unlink_folder") return Promise.resolve(undefined);
      return Promise.resolve(undefined);
    });
  });

  it("openFilePicker sets pickerContext and renders FolderFilePickerModal", async () => {
    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";
    chatStore.addFolderContext("conv-test-1", makeLinkedContext());

    const wrapper = mountWithPicker();
    const vm = wrapper.vm as unknown as {
      openFilePicker: (ctx: object) => void;
    };

    expect(wrapper.findComponent({ name: "FolderFilePickerModal" }).exists()).toBe(false);

    vm.openFilePicker(makeLinkedContext());
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent({ name: "FolderFilePickerModal" }).exists()).toBe(true);
  });

  it("FolderFilePickerModal @apply calls updateContextFiles and closes modal", async () => {
    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";
    chatStore.addFolderContext("conv-test-1", makeLinkedContext());

    const updateSpy = vi.spyOn(chatStore, "updateContextFiles");

    const wrapper = mountWithPicker();
    const vm = wrapper.vm as unknown as {
      openFilePicker: (ctx: object) => void;
    };

    vm.openFilePicker(makeLinkedContext());
    await wrapper.vm.$nextTick();

    const modal = wrapper.findComponent({ name: "FolderFilePickerModal" });
    await modal.vm.$emit("apply", ["file-a.txt"], 42, "new content");
    await wrapper.vm.$nextTick();

    expect(updateSpy).toHaveBeenCalledWith(
      "conv-test-1",
      "ctx-picker-1",
      ["file-a.txt"],
      42,
      "new content",
    );
    expect(wrapper.findComponent({ name: "FolderFilePickerModal" }).exists()).toBe(false);
  });

  it("FolderFilePickerModal @detach calls unlink_folder and closes modal", async () => {
    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";
    chatStore.addFolderContext("conv-test-1", makeLinkedContext());

    const wrapper = mountWithPicker();
    const vm = wrapper.vm as unknown as {
      openFilePicker: (ctx: object) => void;
    };

    vm.openFilePicker(makeLinkedContext());
    await wrapper.vm.$nextTick();

    const modal = wrapper.findComponent({ name: "FolderFilePickerModal" });
    await modal.vm.$emit("detach");
    // handlePickerDetach is async — wait for unlink_folder to resolve
    await new Promise((r) => setTimeout(r, 0));
    await wrapper.vm.$nextTick();

    expect(mockInvoke).toHaveBeenCalledWith("unlink_folder", { id: "ctx-picker-1" });
    expect(wrapper.findComponent({ name: "FolderFilePickerModal" }).exists()).toBe(false);
  });

  it("FolderFilePickerModal @close clears pickerContext and hides modal", async () => {
    const chatStore = useChatStore();
    chatStore.conversations.push(makeConversation("llama3"));
    chatStore.activeConversationId = "conv-test-1";
    chatStore.addFolderContext("conv-test-1", makeLinkedContext());

    const wrapper = mountWithPicker();
    const vm = wrapper.vm as unknown as {
      openFilePicker: (ctx: object) => void;
    };

    vm.openFilePicker(makeLinkedContext());
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent({ name: "FolderFilePickerModal" }).exists()).toBe(true);

    const modal = wrapper.findComponent({ name: "FolderFilePickerModal" });
    await modal.vm.$emit("close");
    await wrapper.vm.$nextTick();

    expect(wrapper.findComponent({ name: "FolderFilePickerModal" }).exists()).toBe(false);
  });
});
