import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import type {
  Conversation,
  Message,
  BackendMessage,
  StreamingState,
  ChatDraft,
  LinkedContext,
  FolderContextPayload,
} from "../types/chat";

const DRAFT_ID_PREFIX = "__draft__";

export function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const useChatStore = defineStore("chat", {
  state: () => ({
    conversations: [] as Conversation[],
    activeConversationId: null as string | null,
    messages: {} as Record<string, Message[]>,
    folderContexts: {} as Record<string, LinkedContext[]>,
    expandedStats: new Set<string>(), // Track which message IDs have full stats visible
    streaming: {
      isStreaming: false,
      currentConversationId: null,
      buffer: "",
      thinkingBuffer: "",
      isThinking: false,
      tokensPerSec: null,
      thinkTime: null,
      toolCalls: [],
      promptTokens: 0,
      evalTokens: 0,
    } as StreamingState,
    _listenersInitialized: false,
    /** Draft conversation — local-only, not yet persisted to DB */
    draftConversation: null as Conversation | null,
    // Pagination
    hasMore: true,
    isLoadingMore: false,
    nextOffset: 0,
    /** In-memory cache of drafts for loaded conversations */
    drafts: {} as Record<string, ChatDraft>,
    /** Temporary system prompt for drafts or newly created chats */
    draftSystemPrompt: "" as string,
  }),

  getters: {
    activeConversation(state): Conversation | undefined {
      if (
        state.draftConversation &&
        state.activeConversationId === state.draftConversation.id
      ) {
        return state.draftConversation;
      }
      return state.conversations.find(
        (c) => c.id === state.activeConversationId,
      );
    },
    activeMessages: (state) => {
      if (!state.activeConversationId) return [];
      return state.messages[state.activeConversationId] ?? [];
    },
    /** True if the active conversation is an unsaved draft */
    isDraft: (state) =>
      state.activeConversationId?.startsWith(DRAFT_ID_PREFIX) ?? false,
    /** True if streaming is active for the currently visible conversation */
    isStreamingForActiveConv: (state) => {
      return (
        state.streaming.isStreaming &&
        state.streaming.currentConversationId === state.activeConversationId
      );
    },
    /** Current user-defined system instructions for the active chat */
    activeSystemPrompt: (state) => {
      if (state.activeConversationId?.startsWith(DRAFT_ID_PREFIX)) {
        return state.draftSystemPrompt;
      }
      if (!state.activeConversationId) return "";
      const msgs = state.messages[state.activeConversationId] ?? [];
      return msgs.find((m) => m.role === "system")?.content ?? "";
    },
    /** Sum of tokens for the active conversation (history + linked contexts) */
    totalActiveTokens: (state) => {
      if (!state.activeConversationId) return 0;
      const msgs = state.messages[state.activeConversationId] ?? [];
      if (msgs.length === 0) {
        // Only linked contexts if no history
        return (state.folderContexts[state.activeConversationId] ?? []).reduce(
          (acc, c) => acc + c.tokens,
          0,
        );
      }

      // The last assistant message has prompt_tokens (all previous history) + eval_tokens (its own length)
      // This is the most accurate representation of current context usage.
      const lastAssistant = [...msgs]
        .reverse()
        .find((m) => m.role === "assistant");

      let baseTokens = 0;
      if (lastAssistant) {
        // prompt_tokens is what the model saw BEFORE generating this message.
        // So total context used after this message is prompt_tokens + eval_tokens.
        baseTokens =
          (lastAssistant.prompt_tokens ?? 0) + (lastAssistant.tokens ?? 0);
      } else {
        // If only user messages (highly unlikely to not have assistant but possible)
        // fall back to rough estimation or sum of user messages if we had their counts
        baseTokens = msgs.reduce((acc, m) => acc + (m.tokens ?? 0), 0);
      }

      const linkedTokens = (
        state.folderContexts[state.activeConversationId] ?? []
      ).reduce((acc, c) => acc + c.tokens, 0);

      return baseTokens + linkedTokens;
    },
  },

  actions: {
    toggleStats(messageId: string) {
      const next = new Set(this.expandedStats);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      this.expandedStats = next;
    },

    finalizeStreamedMessage(
      conversationId: string,
      totalTokens?: number,
      promptTokens?: number,
      tokensPerSec?: number,
      generationTimeMs?: number,
      totalDurationMs?: number,
      loadDurationMs?: number,
      promptEvalDurationMs?: number,
      evalDurationMs?: number,
      seed?: number,
    ) {
      if (!this.messages[conversationId]) {
        this.messages[conversationId] = [];
      }

      // If there's still something in the thinking buffer (e.g. stream ended mid-thought)
      if (this.streaming.thinkingBuffer) {
        this.streaming.buffer += `\n<think>\n${this.streaming.thinkingBuffer}\n</think>\n\n`;
      }

      this.messages[conversationId].push({
        role: "assistant",
        content: this.streaming.buffer,
        tokens: totalTokens ?? this.streaming.evalTokens,
        prompt_tokens: promptTokens ?? this.streaming.promptTokens,
        tokens_per_sec: tokensPerSec ?? (this.streaming.tokensPerSec || 0),
        generation_time_ms: generationTimeMs ?? 0,
        total_duration_ms: totalDurationMs ?? 0,
        load_duration_ms: loadDurationMs ?? 0,
        prompt_eval_duration_ms: promptEvalDurationMs ?? 0,
        eval_duration_ms: evalDurationMs ?? 0,
        seed: seed ?? undefined,
      });

      this.streaming.buffer = "";
      this.streaming.thinkingBuffer = "";
      this.streaming.isThinking = false;
      this.streaming.thinkTime = null;
      this.streaming.toolCalls = [];
    },

    async loadConversations(reset = false) {
      if (reset) {
        this.nextOffset = 0;
        this.hasMore = true;
        this.conversations = [];
      }

      if (!this.hasMore || this.isLoadingMore) return;

      this.isLoadingMore = true;
      try {
        const limit = 20;
        const convs = await invoke<Conversation[]>("list_conversations", {
          limit,
          offset: this.nextOffset,
        });

        if (!convs || convs.length < limit) {
          this.hasMore = false;
        }

        if (reset) {
          this.conversations = convs || [];
        } else {
          // Avoid duplicates if any (though offset usually handles this)
          const existingIds = new Set(this.conversations.map((c) => c.id));
          const newConvs = (convs || []).filter((c) => !existingIds.has(c.id));
          this.conversations.push(...newConvs);
        }

        this.nextOffset += convs?.length || 0;
      } catch (err) {
        console.warn("Could not load conversations", err);
      } finally {
        this.isLoadingMore = false;
      }
    },

    async loadConversation(id: string) {
      // If we are switching back to an already active conversation that has messages,
      // avoid a hard reload from DB to prevent overwriting background streaming updates.
      const previousId = this.activeConversationId;
      const alreadyHasMessages = this.messages[id]?.length > 0;

      this.activeConversationId = id;

      if (previousId === id && alreadyHasMessages) {
        return;
      }

      // If it's a draft chat, we don't need to load messages from DB
      if (id.startsWith(DRAFT_ID_PREFIX)) {
        this.streaming.isStreaming = false;
        this.messages[id] = [];
        return;
      }

      // Populate draft state for the conversation from the store/persisted data
      const conv = this.conversations.find((c) => c.id === id);
      if (conv?.draft_json && !this.drafts[id]) {
        try {
          this.drafts[id] = JSON.parse(conv.draft_json);
        } catch (e) {
          console.warn("Failed to parse draft JSON", e);
        }
      }

      // Fetch history from DB only if we don't have it or we are switching from a different chat
      try {
        const [rawMessages, dbContexts] = await Promise.all([
          invoke<BackendMessage[]>("get_messages", { conversationId: id }),
          invoke<FolderContextPayload[]>("get_folder_contexts", {
            conversationId: id,
          }),
        ]);

        this.messages[id] = (rawMessages || []).map((m) => {
          let images: Uint8Array[] = [];
          try {
            if (m.images_json) {
              const base64s = JSON.parse(m.images_json) as string[];
              images = base64s.map(base64ToUint8Array);
            }
          } catch (e) {
            console.warn("Failed to parse message images", e);
          }

          return {
            role: m.role,
            content: m.content,
            images,
            tokens: m.tokens_used ?? 0,
            prompt_tokens: m.prompt_tokens ?? 0,
            tokens_per_sec: m.tokens_per_sec ?? 0,
            generation_time_ms: m.generation_time_ms ?? 0,
            total_duration_ms: m.total_duration_ms ?? 0,
            load_duration_ms: m.load_duration_ms ?? 0,
            prompt_eval_duration_ms: m.prompt_eval_duration_ms ?? 0,
            eval_duration_ms: m.eval_duration_ms ?? 0,
            seed: m.seed ?? undefined,
          };
        });

        // Read contents of folders for the model context
        const populatedContexts = await Promise.all(
          (dbContexts || []).map(async (ctx) => {
            const payload = await invoke<{
              content: string;
              token_estimate: number;
            }>("link_folder", {
              conversationId: id,
              path: ctx.path,
              // Optimization: if we already had a command to just read content, we'd use it.
              // link_folder is safe and idempotent.
            });
            return {
              id: ctx.id,
              name: ctx.path.split("/").pop() || ctx.path,
              path: ctx.path,
              content: payload.content,
              tokens: payload.token_estimate,
            };
          }),
        );
        this.folderContexts[id] = populatedContexts;
      } catch (err) {
        console.warn("Could not load conversation data", err);
        if (!this.messages[id]) this.messages[id] = [];
      }
    },

    addFolderContext(conversationId: string, context: LinkedContext) {
      if (!this.folderContexts[conversationId]) {
        this.folderContexts[conversationId] = [];
      }
      // Avoid duplicates by path
      const existing = this.folderContexts[conversationId].find(
        (c) => c.path === context.path,
      );
      if (!existing) {
        this.folderContexts[conversationId].push(context);
      }
    },

    removeFolderContext(conversationId: string, contextId: string) {
      if (this.folderContexts[conversationId]) {
        this.folderContexts[conversationId] = this.folderContexts[
          conversationId
        ].filter((c) => c.id !== contextId);
      }
    },

    clearFolderContext(conversationId: string) {
      delete this.folderContexts[conversationId];
    },

    async compactConversation(
      conversationId: string,
      model: string,
      title?: string,
    ): Promise<string> {
      const newConvId = await invoke<string>("compact_conversation", {
        conversationId,
        model,
        title,
      });
      await this.loadConversations(true);
      return newConvId;
    },
  },
});
