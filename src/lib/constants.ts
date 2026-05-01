export const APP_NAME = "Ollama Desktop";
export const DEFAULT_CONTEXT_LIMIT = 4096;
export const MAX_CONVERSATIONS_DISPLAYED = 50;
export const STREAM_THROTTLE_MS = 16;
export const CONVERSATION_RENAME_DELAY_MS = 1500;
export const SIDEBAR_MIN_WIDTH_PX = 180;
export const SIDEBAR_MAX_WIDTH_PX = 450;
export const SIDEBAR_DEFAULT_WIDTH_PX = 280;
export const AUTO_SCROLL_THRESHOLD_PX = 50;
export const STREAM_RENDER_EVERY_N_FRAMES = 4;
export const DRAFT_SAVE_DEBOUNCE_MS = 500;
export const COPY_FEEDBACK_DURATION_MS = 1500;
export const DRAFT_ID_PREFIX = "__draft__";

export const LIBRARY_SIZES: Record<string, number> = {
  "llama3.2:3b": 2,
  "llama3.2:1b": 1.3,
  "llama3.1:8b": 4.7,
  "mistral:7b": 4.1,
  "phi4:14b": 8.9,
  "qwen2.5:7b": 4.7,
  "deepseek-r1:7b": 4.7,
  "nomic-embed-text": 0.274,
};
