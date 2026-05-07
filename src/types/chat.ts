import type { ChatOptions } from "./settings";

export type MessagePart = {
  type: "markdown" | "code" | "think" | "tool";
  content: string;
  language?: string;
  thinkDuration?: number;
  rendered?: string;
  toolName?: string;
  toolQuery?: string;
  toolResults?: SearchResult[];
  isDone?: boolean;
};

export interface Message {
  id?: string;
  conversation_id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  images?: Uint8Array[];
  tokens?: number;
  prompt_tokens?: number;
  tokens_per_sec?: number;
  generation_time_ms?: number;
  total_duration_ms?: number;
  load_duration_ms?: number;
  prompt_eval_duration_ms?: number;
  eval_duration_ms?: number;
  seed?: number;
  created_at?: string;
  parentId?: string | null;
  siblingOrder?: number;
  siblingCount?: number;
  isActive?: boolean;
}

export interface BackendMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  images_json: string;
  files_json: string;
  tokens_used: number | null;
  generation_time_ms: number | null;
  prompt_tokens: number | null;
  tokens_per_sec: number | null;
  total_duration_ms: number | null;
  load_duration_ms: number | null;
  prompt_eval_duration_ms: number | null;
  eval_duration_ms: number | null;
  seed: number | null;
  created_at: string;
  parent_id?: string | null;
  sibling_order?: number;
  sibling_count?: number;
  is_active?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  settings_json: string;
  pinned: boolean;
  tags: string[];
  draft_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface DraftAttachment {
  name: string;
  type: string;
  data: string; // base64
}

export interface LinkedContext {
  id: string;
  name: string;
  path: string;
  content: string;
  tokens: number;
}

export interface ChatDraft {
  content: string;
  attachments: DraftAttachment[];
  linkedContexts: LinkedContext[];
  webSearchEnabled: boolean;
  thinkEnabled: boolean;
  thinkLevel: "low" | "medium" | "high";
  chatOptions?: Partial<ChatOptions>;
  presetId?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface StreamingState {
  isStreaming: boolean;
  currentConversationId: string | null;
  buffer: string;
  thinkingBuffer: string;
  isThinking: boolean;
  tokensPerSec: number | null;
  thinkTime: number | null;
  toolCalls: Array<{ name: string; query: string; result?: string }>;
  searchState: "found" | "reading" | "done" | null;
  searchResults: SearchResult[];
  sidebarOpen: boolean;
  activeSearchMessageId: string | null;
  activeSearchData: SearchResult[];
  promptTokens: number;
  evalTokens: number;
  activeMessageParts: MessagePart[];
  regeneratingMessageId: string | null;
}

export interface TokenPayload {
  conversation_id: string;
  content: string;
  done: boolean;
  prompt_tokens?: number;
  eval_tokens?: number;
}

export interface ThinkingPayload {
  conversation_id: string;
  duration_ms?: number;
}

export interface ThinkingTokenPayload {
  conversation_id: string;
  content: string;
  prompt_tokens?: number;
  eval_tokens?: number;
}

export interface DonePayload {
  conversation_id: string;
  total_tokens: number;
  duration_ms: number;
  prompt_tokens: number;
  tokens_per_sec: number;
  total_duration_ms: number;
  load_duration_ms: number;
  prompt_eval_duration_ms: number;
  eval_duration_ms: number;
  seed?: number | null;
}

export interface ToolCallPayload {
  conversation_id: string;
  tool_name: string;
  query: string;
}

export interface ToolResultPayload {
  conversation_id: string;
  tool_name: string;
  query: string;
  result: string;
}

export interface ToolReadingPayload {
  conversation_id: string;
  results_preview: SearchResult[];
}

export interface FolderContextPayload {
  id: string;
  path: string;
  name?: string;
  token_count?: number;
}

export interface StreamingCallbacks {
  onToken?: (payload: { conversation_id: string; content: string }) => void;
  onThinkingStart?: (convId: string) => void;
  onThinkingToken?: (payload: {
    conversation_id: string;
    content: string;
  }) => void;
  onThinkingEnd?: (convId: string, durationMs?: number) => void;
  onDone?: (payload: { conversation_id: string }) => void;
  onError?: (convId: string, error: string) => void;
  onToolCall?: (payload: {
    conversation_id: string;
    name: string;
    query: string;
  }) => void;
  onToolReading?: (payload: ToolReadingPayload) => void;
  onToolResult?: (payload: {
    conversation_id: string;
    content: string;
  }) => void;
}
