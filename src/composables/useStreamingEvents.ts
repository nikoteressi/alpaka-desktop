import { computed, type Ref } from "vue";
import { useChatStore } from "../stores/chat";
import { useStreaming } from "./useStreaming";
import type {
  TokenPayload,
  ThinkingTokenPayload,
  DonePayload,
  ToolCallPayload,
  ToolReadingPayload,
  ToolResultPayload,
} from "../types/chat";

// Singleton: intentionally module-scoped to survive composable re-instantiation
// and allow cleanup of previous Tauri listeners on re-init (e.g. after logout).
const _streaming = { cleanup: null as (() => void) | null };

export function useStreamingEvents() {
  const chatStore = useChatStore();
  let thinkStartTime = 0;

  function onToken(payload: TokenPayload) {
    const content = payload.content
      .replace("<think>", "")
      .replace("</think>", "");
    if (chatStore.streaming.isThinking) {
      chatStore.streaming.thinkingBuffer += content;
      chatStore.updateActivePart("think", content);
    } else {
      chatStore.streaming.buffer += content;
      chatStore.updateActivePart("markdown", content);
      if (!payload.eval_tokens) {
        chatStore.streaming.evalTokens++;
      }
    }

    if (payload.prompt_tokens) {
      chatStore.streaming.promptTokens = payload.prompt_tokens;
    }
    if (payload.eval_tokens) {
      chatStore.streaming.evalTokens = payload.eval_tokens;
    }
  }

  function onThinkingStart() {
    chatStore.streaming.isThinking = true;
    chatStore.streaming.thinkTime = null;
    thinkStartTime = Date.now();
    chatStore.updateActivePart("think", "");
  }

  function onThinkingToken(payload: ThinkingTokenPayload) {
    chatStore.streaming.thinkingBuffer += payload.content;
    chatStore.updateActivePart("think", payload.content);
    if (payload.prompt_tokens) {
      chatStore.streaming.promptTokens = payload.prompt_tokens;
    }
    if (payload.eval_tokens) {
      chatStore.streaming.evalTokens = payload.eval_tokens;
    } else {
      chatStore.streaming.evalTokens++;
    }
  }

  function onThinkingEnd(_convId: string, durationMs?: number) {
    chatStore.streaming.isThinking = false;
    let time = 0;
    if (durationMs !== undefined) {
      time = durationMs / 1000;
    } else if (thinkStartTime > 0) {
      time = (Date.now() - thinkStartTime) / 1000;
    }

    const timeAttr = time > 0 ? ` time=${time.toFixed(1)}` : "";
    chatStore.streaming.buffer += `<think${timeAttr}>\n${chatStore.streaming.thinkingBuffer}\n</think>\n\n`;
    chatStore.updatePartMetadata("think", {
      thinkDuration: time > 0 ? time : undefined,
    });
    chatStore.streaming.thinkingBuffer = "";
    chatStore.streaming.thinkTime = null;
  }

  function onDone(payload: DonePayload) {
    chatStore.finalizeStreamedMessage(payload.conversation_id, {
      totalTokens: payload.total_tokens,
      promptTokens: payload.prompt_tokens,
      tokensPerSec: payload.tokens_per_sec,
      generationTimeMs: payload.duration_ms,
      totalDurationMs: payload.total_duration_ms,
      loadDurationMs: payload.load_duration_ms,
      promptEvalDurationMs: payload.prompt_eval_duration_ms,
      evalDurationMs: payload.eval_duration_ms,
      seed: payload.seed ?? undefined,
    });
    chatStore.streaming.isStreaming = false;
    chatStore.streaming.tokensPerSec = payload.tokens_per_sec;
  }

  function onCancelled(convId: string) {
    chatStore.finalizeStreamedMessage(convId);
    chatStore.streaming.isStreaming = false;
  }

  function onError(convId: string, error: string) {
    console.error("Chat stream error:", error);
    const errorMsg = `⚠️ **Error**: ${error}`;
    if (chatStore.streaming.buffer.trim()) {
      chatStore.streaming.buffer += `\n\n${errorMsg}`;
      chatStore.updateActivePart("markdown", `\n\n${errorMsg}`);
    } else {
      chatStore.streaming.buffer = errorMsg;
      chatStore.updateActivePart("markdown", errorMsg);
    }
    chatStore.finalizeStreamedMessage(convId);
    chatStore.streaming.isStreaming = false;
  }

  function onToolCall(payload: ToolCallPayload) {
    chatStore.streaming.toolCalls.push({
      name: payload.tool_name,
      query: payload.query,
    });
    chatStore.streaming.searchState = "found";
    chatStore.streaming.buffer += `\n<tool_call name="${payload.tool_name}" query="${payload.query}"></tool_call>\n`;
    chatStore.updateActivePart("tool", "", {
      toolName: payload.tool_name,
      toolQuery: payload.query,
    });
  }

  function onToolReading(payload: ToolReadingPayload) {
    chatStore.streaming.searchState = "reading";
    chatStore.streaming.searchResults = payload.results_preview;
    chatStore.updatePartMetadata("tool", {
      toolResults: payload.results_preview,
    });
  }

  function onToolResult(payload: ToolResultPayload) {
    chatStore.streaming.searchState = "done";
    chatStore.updatePartMetadata("tool", {
      isDone: true,
      content: payload.result,
    });
    const call = chatStore.streaming.toolCalls.find(
      (c) => c.name === payload.tool_name && c.query === payload.query,
    );
    if (call) {
      call.result = payload.result;
    }
    const tag = `<tool_call name="${payload.tool_name}" query="${payload.query}"></tool_call>`;
    const replacement = `<tool_call name="${payload.tool_name}" query="${payload.query}">${payload.result}</tool_call>`;
    chatStore.streaming.buffer = chatStore.streaming.buffer.replace(
      tag,
      replacement,
    );
  }

  async function init() {
    if (chatStore._listenersInitialized) return;

    if (_streaming.cleanup) {
      _streaming.cleanup();
      _streaming.cleanup = null;
    }

    const conversationIdValue = computed(
      () => chatStore.activeConversationId,
    ) as Ref<string | null>;

    const { listenersReady, cleanup } = useStreaming(conversationIdValue, {
      onToken,
      onThinkingStart,
      onThinkingToken,
      onThinkingEnd,
      onDone,
      onCancelled,
      onError,
      onToolCall,
      onToolReading,
      onToolResult,
    });

    try {
      await listenersReady;
      _streaming.cleanup = cleanup;
      chatStore._listenersInitialized = true;
    } catch (e) {
      _streaming.cleanup = null;
      cleanup();
      throw e;
    }
  }

  return { init };
}
