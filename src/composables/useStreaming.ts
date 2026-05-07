import { ref, type Ref } from "vue";
import { listen } from "@tauri-apps/api/event";
import type {
  TokenPayload,
  ThinkingPayload,
  ThinkingTokenPayload,
  DonePayload,
  ToolCallPayload,
  ToolResultPayload,
  ToolReadingPayload,
} from "../types/chat";

export interface StreamingCallbacks {
  onToken?: (payload: TokenPayload) => void;
  onThinkingStart?: (conversationId: string) => void;
  onThinkingToken?: (payload: ThinkingTokenPayload) => void;
  onThinkingEnd?: (conversationId: string, durationMs?: number) => void;
  onDone?: (payload: DonePayload) => void;
  onCancelled?: (conversationId: string) => void;
  onError?: (conversationId: string, error: string) => void;
  onToolCall?: (payload: ToolCallPayload) => void;
  onToolReading?: (payload: ToolReadingPayload) => void;
  onToolResult?: (payload: ToolResultPayload) => void;
}

export function useStreaming(
  conversationId: Ref<string | null>,
  callbacks: StreamingCallbacks = {},
) {
  const buffer = ref("");
  const thinkingBuffer = ref("");
  const isThinking = ref(false);
  const isStreaming = ref(false);
  const tokensPerSec = ref<number | null>(null);

  const unlisteners: Array<() => void> = [];

  async function setupListeners() {
    const unlistenToken = await listen<TokenPayload>("chat:token", (event) => {
      if (
        conversationId.value &&
        event.payload.conversation_id !== conversationId.value
      )
        return;
      if (isThinking.value) {
        thinkingBuffer.value += event.payload.content;
      } else {
        buffer.value += event.payload.content;
      }
      callbacks.onToken?.(event.payload);
    });

    const unlistenThinkingStart = await listen<ThinkingPayload>(
      "chat:thinking-start",
      (event) => {
        if (
          conversationId.value &&
          event.payload.conversation_id !== conversationId.value
        )
          return;
        isThinking.value = true;
        callbacks.onThinkingStart?.(event.payload.conversation_id);
      },
    );

    const unlistenThinkingToken = await listen<ThinkingTokenPayload>(
      "chat:thinking-token",
      (event) => {
        if (
          conversationId.value &&
          event.payload.conversation_id !== conversationId.value
        )
          return;
        thinkingBuffer.value += event.payload.content;
        callbacks.onThinkingToken?.(event.payload);
      },
    );

    const unlistenThinkingEnd = await listen<ThinkingPayload>(
      "chat:thinking-end",
      (event) => {
        if (
          conversationId.value &&
          event.payload.conversation_id !== conversationId.value
        )
          return;
        isThinking.value = false;
        callbacks.onThinkingEnd?.(
          event.payload.conversation_id,
          event.payload.duration_ms,
        );
      },
    );

    const unlistenDone = await listen<DonePayload>("chat:done", (event) => {
      if (
        conversationId.value &&
        event.payload.conversation_id !== conversationId.value
      )
        return;
      isStreaming.value = false;
      tokensPerSec.value = event.payload.tokens_per_sec;
      callbacks.onDone?.(event.payload);
    });

    const unlistenToolCall = await listen<ToolCallPayload>(
      "chat:tool-call",
      (event) => {
        if (
          conversationId.value &&
          event.payload.conversation_id !== conversationId.value
        )
          return;
        callbacks.onToolCall?.(event.payload);
      },
    );

    const unlistenToolReading = await listen<ToolReadingPayload>(
      "chat:tool-reading",
      (event) => {
        if (
          conversationId.value &&
          event.payload.conversation_id !== conversationId.value
        )
          return;
        callbacks.onToolReading?.(event.payload);
      },
    );

    const unlistenToolResult = await listen<ToolResultPayload>(
      "chat:tool-result",
      (event) => {
        if (
          conversationId.value &&
          event.payload.conversation_id !== conversationId.value
        )
          return;
        callbacks.onToolResult?.(event.payload);
      },
    );

    const unlistenError = await listen<{
      conversation_id: string;
      error: string;
    }>("chat:error", (event) => {
      if (
        conversationId.value &&
        event.payload.conversation_id !== conversationId.value
      )
        return;
      callbacks.onError?.(event.payload.conversation_id, event.payload.error);
    });

    const unlistenCancelled = await listen<{ conversation_id: string }>(
      "chat:cancelled",
      (event) => {
        if (
          conversationId.value &&
          event.payload.conversation_id !== conversationId.value
        )
          return;
        callbacks.onCancelled?.(event.payload.conversation_id);
      },
    );

    unlisteners.push(
      unlistenToken,
      unlistenThinkingStart,
      unlistenThinkingToken,
      unlistenThinkingEnd,
      unlistenDone,
      unlistenToolCall,
      unlistenToolReading,
      unlistenToolResult,
      unlistenError,
      unlistenCancelled,
    );
  }

  // Listeners are permanent (app lifetime) — cleanup is exposed for explicit
  // use if needed, but onUnmounted is intentionally omitted since this
  // composable is called from a Pinia store (not a component lifecycle).
  const listenersReady = setupListeners();

  function reset() {
    buffer.value = "";
    thinkingBuffer.value = "";
    isThinking.value = false;
    isStreaming.value = true;
    tokensPerSec.value = null;
  }

  function cleanup() {
    unlisteners.forEach((fn) => fn());
    unlisteners.length = 0;
  }

  return {
    buffer,
    thinkingBuffer,
    isThinking,
    isStreaming,
    tokensPerSec,
    reset,
    cleanup,
    listenersReady,
  };
}
