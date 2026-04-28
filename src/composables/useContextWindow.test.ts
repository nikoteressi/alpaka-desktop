import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { ref } from "vue";
import { useContextWindow } from "./useContextWindow";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("useContextWindow", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("contextPercentage is 0 when there are no tokens", () => {
    const { contextPercentage } = useContextWindow({
      inputLength: ref(0),
      attachmentCount: ref(0),
      numCtxOverride: ref(undefined),
      modelNativeCtx: ref(undefined),
      globalNumCtx: ref(undefined),
      globalSystemPrompt: ref(""),
    });
    expect(contextPercentage.value).toBe(0);
  });

  it("contextPercentage reaches 100 when tokens equal maxContext", () => {
    const { contextPercentage } = useContextWindow({
      inputLength: ref(4), // ceil(4/4) = 1 token
      attachmentCount: ref(0),
      numCtxOverride: ref(1),
      modelNativeCtx: ref(1),
      globalNumCtx: ref(undefined),
      globalSystemPrompt: ref(""),
    });
    expect(contextPercentage.value).toBe(100);
  });

  it("isContextNearFull is true when percentage >= 70", () => {
    const { isContextNearFull } = useContextWindow({
      inputLength: ref(0),
      attachmentCount: ref(0),
      numCtxOverride: ref(undefined),
      modelNativeCtx: ref(100),
      globalNumCtx: ref(undefined),
      globalSystemPrompt: ref("a".repeat(280)), // 280/4 = 70 tokens → 70% of 100
    });
    // With no active messages, systemPromptTokens = 70, maxContext = 100 → 70%
    expect(isContextNearFull.value).toBe(true);
  });
});
