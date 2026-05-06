import { computed, type Ref } from "vue";
import { useChatStore } from "../stores/chat";
import { useStreaming } from "./useStreaming";

// Singleton: intentionally module-scoped to survive composable re-instantiation
// and allow cleanup of previous Tauri listeners on re-init (e.g. after logout).
const _streaming = { cleanup: null as (() => void) | null };

export function useStreamingEvents() {
  const chatStore = useChatStore();

  async function init() {
    if (chatStore._listenersInitialized) return;

    // Tear down any previous listener set before registering a new one.
    if (_streaming.cleanup) {
      _streaming.cleanup();
      _streaming.cleanup = null;
    }

    const conversationIdValue = computed(
      () => chatStore.activeConversationId,
    ) as Ref<string | null>;
    let thinkStartTime = 0;

    const { listenersReady, cleanup } = useStreaming(conversationIdValue, {
      onToken: (payload) => {
        const content = payload.content
          .replace("<think>", "")
          .replace("</think>", "");
        if (chatStore.streaming.isThinking) {
          chatStore.streaming.thinkingBuffer += content;
        } else {
          chatStore.streaming.buffer += content;
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
      },
      onThinkingStart: () => {
        chatStore.streaming.isThinking = true;
        chatStore.streaming.thinkTime = null;
        thinkStartTime = Date.now();
      },
      onThinkingToken: (payload) => {
        chatStore.streaming.thinkingBuffer += payload.content;
        if (payload.prompt_tokens) {
          chatStore.streaming.promptTokens = payload.prompt_tokens;
        }
        if (payload.eval_tokens) {
          chatStore.streaming.evalTokens = payload.eval_tokens;
        } else {
          chatStore.streaming.evalTokens++;
        }
      },
      onThinkingEnd: (_convId, durationMs) => {
        chatStore.streaming.isThinking = false;
        let time = 0;
        if (durationMs !== undefined) {
          time = durationMs / 1000;
        } else if (thinkStartTime > 0) {
          time = (Date.now() - thinkStartTime) / 1000;
        }

        const timeAttr = time > 0 ? ` time=${time.toFixed(1)}` : "";
        chatStore.streaming.buffer += `<think${timeAttr}>\n${chatStore.streaming.thinkingBuffer}\n</think>\n\n`;
        chatStore.streaming.thinkingBuffer = "";
        chatStore.streaming.thinkTime = null;
      },
      onDone: (payload) => {
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
      },
      onCancelled: (convId) => {
        chatStore.finalizeStreamedMessage(convId);
        chatStore.streaming.isStreaming = false;
      },
      onError: (_convId, error) => {
        console.error("Chat stream error:", error);
        if (chatStore.streaming.buffer.trim()) {
          chatStore.streaming.buffer += `\n\n⚠️ **Error**: ${error}`;
        } else {
          chatStore.streaming.buffer = `⚠️ **Error**: ${error}`;
        }
        chatStore.finalizeStreamedMessage(_convId);
        chatStore.streaming.isStreaming = false;
      },
      onToolCall: (payload) => {
        chatStore.streaming.toolCalls.push({
          name: payload.tool_name,
          query: payload.query,
        });
        // Append tag for persistence
        chatStore.streaming.buffer += `\n<tool_call name="${payload.tool_name}" query="${payload.query}"></tool_call>\n`;
      },
      onToolResult: (payload) => {
        const call = chatStore.streaming.toolCalls.find(
          (c) => c.name === payload.tool_name && c.query === payload.query,
        );
        if (call) {
          call.result = payload.result;
        }
        // Update the tag in the buffer with the result
        const tag = `<tool_call name="${payload.tool_name}" query="${payload.query}"></tool_call>`;
        const replacement = `<tool_call name="${payload.tool_name}" query="${payload.query}">${payload.result}</tool_call>`;
        chatStore.streaming.buffer = chatStore.streaming.buffer.replace(
          tag,
          replacement,
        );
      },
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
