import { computed, type Ref } from "vue";
import { useChatStore } from "../stores/chat";

interface ContextWindowOptions {
  inputLength: Ref<number>;
  attachmentCount: Ref<number>;
  numCtxOverride: Ref<number | undefined>;
  modelNativeCtx: Ref<number | undefined>;
  globalNumCtx: Ref<number | undefined>;
  globalSystemPrompt: Ref<string>;
  isStreaming?: Ref<boolean>;
}

export function useContextWindow(opts: ContextWindowOptions) {
  const chatStore = useChatStore();

  const maxContext = computed(() => {
    const effective =
      opts.numCtxOverride.value ??
      opts.globalNumCtx.value ??
      opts.modelNativeCtx.value ??
      4096;
    return opts.modelNativeCtx.value
      ? Math.min(effective, opts.modelNativeCtx.value)
      : effective;
  });

  const contextTokens = computed(() => {
    const inputTokens = Math.ceil(opts.inputLength.value / 4);
    // ~600 tokens per image is a conservative estimate for vision models
    const imageTokens = opts.attachmentCount.value * 600;

    if (opts.isStreaming?.value) {
      // Ollama reports actual token counts once streaming starts — more accurate than estimates
      return chatStore.streaming.promptTokens + chatStore.streaming.evalTokens;
    }

    // Before first assistant reply, prompt_eval_count is 0 — estimate system prompt overhead
    const hasAssistantReply = chatStore.activeMessages.some(
      (m) => m.role === "assistant",
    );
    const systemPromptTokens = !hasAssistantReply
      ? Math.ceil(opts.globalSystemPrompt.value.length / 4)
      : 0;

    return (
      chatStore.totalActiveTokens +
      inputTokens +
      imageTokens +
      systemPromptTokens
    );
  });

  const contextPercentage = computed(() =>
    maxContext.value > 0 ? (contextTokens.value / maxContext.value) * 100 : 0,
  );

  const isContextNearFull = computed(() => contextPercentage.value >= 70);

  return { maxContext, contextTokens, contextPercentage, isContextNearFull };
}
