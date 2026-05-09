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
  MessagePart,
  SearchResult,
} from "../types/chat";
import { DRAFT_ID_PREFIX } from "../lib/constants";
import { tauriApi } from "../lib/tauri";

export interface StreamFinalizeStats {
  totalTokens?: number;
  promptTokens?: number;
  tokensPerSec?: number;
  generationTimeMs?: number;
  totalDurationMs?: number;
  loadDurationMs?: number;
  promptEvalDurationMs?: number;
  evalDurationMs?: number;
  seed?: number;
}

export function base64ToUint8Array(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.codePointAt(i) ?? 0;
  }
  return bytes;
}

function decodeImages(imagesJson: string): Uint8Array[] {
  try {
    if (!imagesJson) return [];
    return (JSON.parse(imagesJson) as string[]).map(base64ToUint8Array);
  } catch {
    return [];
  }
}

export function mapBackendMessage(m: BackendMessage): Message {
  return {
    id: m.id,
    conversation_id: m.conversation_id,
    role: m.role,
    content: m.content,
    images: decodeImages(m.images_json),
    tokens: m.tokens_used ?? undefined,
    prompt_tokens: m.prompt_tokens ?? undefined,
    tokens_per_sec: m.tokens_per_sec ?? undefined,
    generation_time_ms: m.generation_time_ms ?? undefined,
    total_duration_ms: m.total_duration_ms ?? undefined,
    load_duration_ms: m.load_duration_ms ?? undefined,
    prompt_eval_duration_ms: m.prompt_eval_duration_ms ?? undefined,
    eval_duration_ms: m.eval_duration_ms ?? undefined,
    seed: m.seed ?? undefined,
    created_at: m.created_at,
    parentId: m.parent_id ?? null,
    siblingOrder: m.sibling_order ?? 0,
    siblingCount: m.sibling_count ?? 1,
    isActive: m.is_active ?? true,
  };
}

export function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCodePoint(bytes[i]);
  }
  return btoa(binary);
}

function initialStreaming(): StreamingState {
  return {
    isStreaming: false,
    currentConversationId: null,
    buffer: "",
    thinkingBuffer: "",
    isThinking: false,
    tokensPerSec: null,
    thinkTime: null,
    toolCalls: [],
    searchState: null,
    searchResults: [],
    sidebarOpen: false,
    activeSearchMessageId: null,
    activeSearchData: [],
    promptTokens: 0,
    evalTokens: 0,
    activeMessageParts: [],
    regeneratingMessageId: null,
  };
}

export const useChatStore = defineStore("chat", {
  state: () => ({
    conversations: [] as Conversation[],
    activeConversationId: null as string | null,
    messages: {} as Record<string, Message[]>, // NOSONAR
    folderContexts: {} as Record<string, LinkedContext[]>, // NOSONAR
    expandedStats: new Set<string>(),
    streaming: initialStreaming(),
    _listenersInitialized: false,
    /** Draft conversation — local-only, not yet persisted to DB */
    draftConversation: null as Conversation | null,
    // Pagination
    hasMore: true,
    isLoadingMore: false,
    nextOffset: 0,
    /** In-memory cache of drafts for loaded conversations */
    drafts: {} as Record<string, ChatDraft>, // NOSONAR
    /** Temporary system prompt for drafts or newly created chats */
    draftSystemPrompt: "",
    compactionInProgress: {} as Record<string, boolean>, // NOSONAR
    compactionTokens: {} as Record<string, string>, // NOSONAR
    archivedMessages: {} as Record<string, import("../types/chat").Message[]>, // NOSONAR
    showingHistory: new Set<string>(),
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
      stats: StreamFinalizeStats = {},
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
        tokens: stats.totalTokens ?? this.streaming.evalTokens,
        prompt_tokens: stats.promptTokens ?? this.streaming.promptTokens,
        tokens_per_sec:
          stats.tokensPerSec ?? (this.streaming.tokensPerSec || 0),
        generation_time_ms: stats.generationTimeMs ?? 0,
        total_duration_ms: stats.totalDurationMs ?? 0,
        load_duration_ms: stats.loadDurationMs ?? 0,
        prompt_eval_duration_ms: stats.promptEvalDurationMs ?? 0,
        eval_duration_ms: stats.evalDurationMs ?? 0,
        seed: stats.seed ?? undefined,
      });

      this.streaming.buffer = "";
      this.streaming.thinkingBuffer = "";
      this.streaming.isThinking = false;
      this.streaming.thinkTime = null;
      this.streaming.toolCalls = [];
      this.streaming.searchState = null;
      this.streaming.searchResults = [];
      this.streaming.activeMessageParts = [];
      this.streaming.regeneratingMessageId = null;
    },

    // Avoids re-parsing the entire buffer on every token.
    updateActivePart(
      type: MessagePart["type"],
      content: string,
      metadata: Partial<MessagePart> = {},
    ) {
      const parts = this.streaming.activeMessageParts;
      const lastPart = parts[parts.length - 1];

      // If we're continuing the same part type, append content
      if (
        lastPart &&
        lastPart.type === type &&
        (type === "markdown" || type === "think")
      ) {
        lastPart.content += content;
        return;
      }

      // Otherwise, create a new part
      parts.push({ type, content, ...metadata } as MessagePart); // NOSONAR
    },

    updatePartMetadata(
      type: MessagePart["type"],
      metadata: Partial<MessagePart>,
    ) {
      const parts = this.streaming.activeMessageParts;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].type === type) {
          Object.assign(parts[i], metadata);
          break;
        }
      }
    },

    openSearchSidebar(messageId: string | null, results: SearchResult[]) {
      this.streaming.sidebarOpen = true;
      this.streaming.activeSearchMessageId = messageId;
      this.streaming.activeSearchData = results;
    },

    closeSearchSidebar() {
      this.streaming.sidebarOpen = false;
      this.streaming.activeSearchMessageId = null;
      this.streaming.activeSearchData = [];
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

        if (this.activeConversationId !== id) return;

        this.messages[id] = (rawMessages || []).map(mapBackendMessage);

        // Read contents of folders for the model context
        const populatedContexts = await Promise.all(
          (dbContexts || []).map(async (ctx) => {
            // Parse included files first
            let includedFiles: string[] | undefined;
            if (ctx.included_files_json) {
              try {
                const parsed = JSON.parse(ctx.included_files_json) as string[];
                if (Array.isArray(parsed) && parsed.length > 0) {
                  includedFiles = parsed;
                }
              } catch {
                // malformed JSON — treat as no filter
              }
            }

            let content: string;
            let tokens: number;

            if (includedFiles) {
              // User has a file selection — fetch only those files' content
              const filtered = await tauriApi.getIncludedFilesContent(ctx.id);
              content = filtered.content;
              tokens = filtered.token_estimate;
            } else {
              // No filter — read the whole folder
              const payload = await invoke<{
                content: string;
                token_estimate: number;
              }>("link_folder", {
                conversationId: id,
                path: ctx.path,
              });
              content = payload.content;
              tokens = payload.token_estimate;
            }

            return {
              id: ctx.id,
              name: ctx.path.split("/").pop() || ctx.path,
              path: ctx.path,
              content,
              tokens,
              includedFiles,
              autoRefresh: ctx.auto_refresh ?? false,
            };
          }),
        );

        if (this.activeConversationId !== id) return;

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

    updateContextFiles(
      conversationId: string,
      contextId: string,
      files: string[],
      tokens: number,
      content: string,
    ) {
      const ctx = this.folderContexts[conversationId]?.find(
        (c) => c.id === contextId,
      );
      if (ctx) {
        ctx.includedFiles = files.length > 0 ? files : undefined;
        ctx.tokens = tokens;
        ctx.content = content;
      }
    },

    clearFolderContext(conversationId: string) {
      delete this.folderContexts[conversationId];
    },

    _findContextById(contextId: string): LinkedContext | undefined {
      for (const convId of Object.keys(this.folderContexts)) {
        const ctx = this.folderContexts[convId]?.find(
          (c) => c.id === contextId,
        );
        if (ctx) return ctx;
      }
      return undefined;
    },

    updateContextTokens(contextId: string, tokenEstimate: number) {
      const ctx = this._findContextById(contextId);
      if (ctx) ctx.tokens = tokenEstimate;
    },

    setContextAutoRefresh(contextId: string, enabled: boolean) {
      const ctx = this._findContextById(contextId);
      if (ctx) ctx.autoRefresh = enabled;
    },

    async compactConversation(
      conversationId: string,
      model: string,
    ): Promise<void> {
      this.compactionInProgress[conversationId] = true;
      this.compactionTokens[conversationId] = "";
      try {
        await invoke<void>("compact_conversation", { conversationId, model });
        // compact:done event is the single owner of cache-clear + reload for both
        // UI-triggered and future background-triggered compaction paths.
      } catch (e) {
        console.error("Compact failed:", e);
        this.finishCompaction(conversationId);
      }
    },

    appendCompactionToken(conversationId: string, content: string) {
      this.compactionTokens[conversationId] =
        (this.compactionTokens[conversationId] ?? "") + content;
    },

    finishCompaction(conversationId: string) {
      delete this.compactionInProgress[conversationId];
      delete this.compactionTokens[conversationId];
      delete this.archivedMessages[conversationId];
    },

    async cancelCompaction(): Promise<void> {
      await invoke("cancel_compaction");
    },

    async loadArchivedMessages(conversationId: string): Promise<void> {
      const rawMessages = await invoke<BackendMessage[]>(
        "get_archived_messages",
        {
          conversationId,
        },
      );
      this.archivedMessages[conversationId] = (rawMessages || []).map(
        mapBackendMessage,
      );
    },

    async toggleHistory(conversationId: string): Promise<void> {
      if (this.showingHistory.has(conversationId)) {
        this.showingHistory.delete(conversationId);
      } else {
        this.showingHistory.add(conversationId);
        if (!this.archivedMessages[conversationId]) {
          await this.loadArchivedMessages(conversationId);
        }
      }
    },

    async switchVersion(siblingId: string): Promise<void> {
      await invoke("switch_version", { siblingId });
      const id = this.activeConversationId;
      if (id) {
        // Clear cached messages to bypass the early-return guard in loadConversation.
        delete this.messages[id];
        await this.loadConversation(id);
      }
    },

    async navigateVersion(messageId: string, direction: 1 | -1): Promise<void> {
      await invoke("navigate_version", { messageId, direction });
      const id = this.activeConversationId;
      if (id) {
        delete this.messages[id];
        await this.loadConversation(id);
      }
    },

    clearMessages(conversationId: string): void {
      delete this.messages[conversationId];
    },

    async refreshMessages(conversationId: string): Promise<void> {
      try {
        const rawMessages = await invoke<BackendMessage[]>("get_messages", {
          conversationId,
        });
        if (this.activeConversationId !== conversationId) return;
        this.messages[conversationId] = (rawMessages || []).map(
          mapBackendMessage,
        );
      } catch (err) {
        console.warn("Could not refresh messages", err);
      }
    },

    async regenerateMessage(parentMessageId: string): Promise<void> {
      const conversationId = this.activeConversationId;
      if (!conversationId) return;
      const conv = this.conversations.find((c) => c.id === conversationId);
      if (!conv) return;

      // Mirror streaming setup so the send button is blocked and the streaming bubble appears
      this.streaming.isStreaming = true;
      this.streaming.currentConversationId = conversationId;
      this.streaming.buffer = "";
      this.streaming.thinkingBuffer = "";
      this.streaming.isThinking = false;
      this.streaming.tokensPerSec = null;
      this.streaming.promptTokens = 0;
      this.streaming.evalTokens = 0;
      this.streaming.searchState = null;
      this.streaming.searchResults = [];
      this.streaming.activeMessageParts = [];
      this.streaming.regeneratingMessageId = parentMessageId;

      try {
        await invoke("regenerate_message", {
          conversationId,
          parentMessageId,
          model: conv.model,
          thinkMode: null,
          chatOptions: null,
          webSearchEnabled: false,
        });
      } catch (err) {
        // invoke failed before streaming started; clean up
        this.streaming.isStreaming = false;
        this.streaming.regeneratingMessageId = null;
        throw err;
      }
      // isStreaming is reset by onDone event handler; just clear the regen flag
      this.streaming.regeneratingMessageId = null;
    },
  },
});
