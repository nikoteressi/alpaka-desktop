import { describe, it, expect, vi, beforeEach } from "vitest";
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
