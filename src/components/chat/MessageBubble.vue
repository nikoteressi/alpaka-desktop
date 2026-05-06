<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import { useRafFn } from "@vueuse/core";
import { renderMarkdown } from "../../lib/markdown";
import type { Message } from "../../types/chat";
import ThinkBlock from "./ThinkBlock.vue";
import CodeBlock from "./CodeBlock.vue";
import SearchBlock from "./SearchBlock.vue";
import StatsBlock from "./StatsBlock.vue";
import TypingIndicator from "./TypingIndicator.vue";
import { useSettingsStore } from "../../stores/settings";
import { useCopyToClipboard } from "../../composables/useCopyToClipboard";
import { uint8ArrayToBase64 } from "../../stores/chat";
import {
  parseMessageParts,
  parseBlockMatch,
  type MessagePart,
} from "../../lib/messageParser";

const props = defineProps<{
  message: Message;
  messageId?: string;
  isStreaming?: boolean;
  thinkingContent?: string; // Streaming thinking
  isThinking?: boolean;
  tokensPerSec?: number | null;
}>();

const isUser = computed(() => props.message.role === "user");

// Memoization cache for finished messages
const _parsedCache = ref<{ key: string; result: MessagePart[] } | null>(null);

// Calculate parts immediately for finished messages, or use a throttled ref for streaming
const staticParts = computed(() => {
  if (props.isStreaming) return null;

  // Use content length + first 32 chars as a cheap cache key
  const cacheKey = `${props.message.content.length}:${props.message.content.slice(0, 32)}`;

  if (_parsedCache.value?.key === cacheKey) {
    return _parsedCache.value.result;
  }

  const result = parseMessageParts(props.message.content, {
    renderMarkdown,
    isUserMessage: isUser.value,
  });
  _parsedCache.value = { key: cacheKey, result };
  return result;
});

const streamingParts = ref<MessagePart[]>([]);
const stableParts = ref<MessagePart[]>([]);
let lastStableIndex = 0;

// Final display parts: static if finished, streaming ref if active
const displayParts = computed(() => {
  return staticParts.value || streamingParts.value;
});

let frameCount = 0;
const RENDER_EVERY_N_FRAMES = 4; // Approx 15fps during streaming for maximum smoothness/CPU balance

// Architectural Throttling for streaming only
const { pause, resume, isActive } = useRafFn(
  () => {
    if (!props.isStreaming) return;
    frameCount++;
    if (frameCount % RENDER_EVERY_N_FRAMES !== 0) return;

    const content = props.message.content;
    if (!content) return;

    // Incremental Update Logic — only look for *fully closed* blocks to stabilize them
    const stableBlockRegex =
      /```(\w+)?\n(.*?)```|<think.*?<\/think>|<tool_call\b[^>]*>.*?<\/tool_call>/gis;
    stableBlockRegex.lastIndex = lastStableIndex;
    let match;

    while ((match = stableBlockRegex.exec(content)) !== null) {
      if (match.index > lastStableIndex) {
        const text = content.slice(lastStableIndex, match.index);
        if (text.trim()) {
          stableParts.value.push({
            type: "markdown",
            content: text,
            rendered: renderMarkdown(text),
          });
        }
      }
      const part = parseBlockMatch(match);
      if (part) stableParts.value.push(part);
      lastStableIndex = stableBlockRegex.lastIndex;
    }

    // Parse the volatile tail (from lastStableIndex to end)
    const volatileContent = content.slice(lastStableIndex);
    streamingParts.value = [
      ...stableParts.value,
      ...parseMessageParts(volatileContent, {
        renderMarkdown,
        allowOpenFence: true,
      }),
    ];
  },
  { immediate: false },
);

watch(
  () => props.isStreaming,
  (streaming) => {
    if (streaming) {
      frameCount = 0;
      stableParts.value = [];
      lastStableIndex = 0;
      resume();
    } else {
      pause();
      streamingParts.value = [];
      stableParts.value = [];
      lastStableIndex = 0;
    }
  },
  { immediate: true },
);

// Watch for streaming content changes
watch(
  () => props.message.content,
  () => {
    if (props.isStreaming && !isActive.value) {
      resume();
    }
  },
);

onUnmounted(() => pause());

// Copy button state via composable
const { copied, copy } = useCopyToClipboard(1500);

const copyContent = async () => {
  await copy(props.message.content);
};

const settingsStore = useSettingsStore();
</script>

<template>
  <!-- User message: right-aligned bubble -->
  <article
    v-if="isUser"
    aria-label="Your message"
    class="user-message"
    data-role="user"
    style="display: flex; justify-content: flex-end; padding: 4px 24px"
  >
    <div
      style="
        background: var(--bg-user-msg);
        border-radius: 18px;
        border-top-right-radius: 4px;
        padding: 8px 14px;
        font-size: 14px;
        color: var(--text);
        max-width: 70%;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        border: 1px solid var(--border-subtle);
      "
    >
      <!-- Attached Images -->
      <div
        v-if="message.images && message.images.length > 0"
        class="flex flex-wrap gap-2 mb-2"
      >
        <img
          v-for="(img, idx) in message.images"
          :key="idx"
          :src="`data:image/png;base64,${uint8ArrayToBase64(img)}`"
          alt="Attached image"
          class="max-h-64 max-w-full rounded-lg object-contain border border-[var(--border-strong)]"
        />
      </div>
      {{ message.content }}
    </div>
  </article>

  <!-- Assistant message: plain text area, no bubble -->
  <article
    v-else
    aria-label="Assistant response"
    aria-live="polite"
    aria-atomic="false"
    class="assistant-message"
    data-role="assistant"
    style="padding: 12px 24px 20px"
  >
    <!-- Rendered Content Parts (including archived thinking and tool blocks) -->
    <div
      class="prose dark:prose-invert prose-sm max-w-none rendered-markdown-container"
    >
      <template v-for="(part, index) in displayParts" :key="index">
        <ThinkBlock
          v-if="part.type === 'think'"
          :key="messageId ? `${messageId}-think-${index}` : `think-${index}`"
          :content="part.content"
          :is-thinking="false"
          :think-time="part.language ? parseFloat(part.language) : null"
          :message-key="messageId ? `${messageId}-think-${index}` : undefined"
        />
        <div
          v-else-if="part.type === 'markdown'"
          class="rendered-markdown"
          v-html="part.rendered"
        ></div>
        <CodeBlock
          v-else-if="part.type === 'code'"
          :code="part.content"
          :language="part.language || ''"
          :is-streaming="isStreaming"
        />
        <SearchBlock
          v-else-if="part.type === 'tool'"
          :query="part.toolQuery || ''"
          :result="part.content"
          :message-key="messageId ? `${messageId}-tool-${index}` : undefined"
        />
      </template>

      <!-- Live streaming thinking (rendered at the end of the sequence) -->
      <ThinkBlock
        v-if="isThinking && thinkingContent"
        key="streaming-think"
        :content="thinkingContent"
        :is-thinking="true"
        message-key="msg-streaming-active"
      />
    </div>

    <!-- Typing indicator: shown before first token arrives -->
    <TypingIndicator
      v-if="isStreaming && !isThinking && !message.content && !thinkingContent"
    />

    <!-- Blinking cursor: shown during streaming once content has started -->
    <span
      v-else-if="
        isStreaming && !isThinking && (message.content || thinkingContent)
      "
      class="streaming-cursor"
    ></span>

    <!-- Copy button (shown only when not streaming) -->
    <button
      v-if="!isStreaming"
      @click="copyContent"
      :title="copied ? 'Copied!' : 'Copy'"
      aria-label="Copy message"
      class="copy-btn"
    >
      <!-- Checkmark icon when copied -->
      <svg
        v-if="copied"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <!-- Copy icon otherwise -->
      <svg
        v-else
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span>{{ copied ? "Copied!" : "Copy" }}</span>
    </button>

    <!-- Full Stats Block (Isolated component) -->
    <StatsBlock
      v-if="
        settingsStore.showPerformanceMetrics &&
        (message.tokens_per_sec !== undefined ||
          message.tokens !== undefined ||
          tokensPerSec !== undefined) &&
        !isStreaming
      "
      :metrics="{
        total_duration_ms: message.total_duration_ms,
        load_duration_ms: message.load_duration_ms,
        prompt_eval_duration_ms: message.prompt_eval_duration_ms,
        eval_duration_ms: message.eval_duration_ms,
      }"
      :tokens-per-sec="message.tokens_per_sec || tokensPerSec || 0"
      :output-tokens="message.tokens || 0"
      :input-tokens="message.prompt_tokens || 0"
      :generation-time-ms="message.generation_time_ms || 0"
      :message-key="messageId"
      :seed="message.seed"
    />
  </article>
</template>

<style scoped>
/* ── Container typography ─────────────────────────────── */
.rendered-markdown-container {
  font-family: var(--sans);
  font-size: 15px;
  color: var(--text);
  line-height: 1.65;
  text-align: left;
}

/* Hide raw <pre> from markdown-it — CodeBlock handles code rendering */
.rendered-markdown :deep(pre) {
  display: none !important;
}

/* ── Headings ─────────────────────────────────────────── */
.rendered-markdown-container :deep(h1),
.rendered-markdown-container :deep(h2),
.rendered-markdown-container :deep(h3) {
  font-family: var(--heading);
  color: var(--text-heading);
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

/* ── Paragraphs & lists ───────────────────────────────── */
.rendered-markdown-container :deep(p) {
  margin-bottom: 1.25em;
}

.rendered-markdown-container :deep(ul),
.rendered-markdown-container :deep(ol) {
  margin-bottom: 1.25em;
  padding-left: 1.5em;
}

.rendered-markdown-container :deep(li) {
  margin-bottom: 0.25em;
}

.rendered-markdown-container :deep(p:last-child) {
  margin-bottom: 0;
}

/* ── Horizontal rule ──────────────────────────────────── */
.rendered-markdown-container :deep(hr) {
  border: none;
  height: 1px;
  background: var(--border-subtle);
  margin: 2em 0;
}

/* ── Bold ─────────────────────────────────────────────── */
.rendered-markdown-container :deep(strong) {
  color: var(--text-heading);
  font-weight: 600;
}

/* ── Inline code ──────────────────────────────────────── */
.rendered-markdown :deep(code:not(pre code)) {
  background-color: var(--bg-code-hdr);
  color: var(--text-code);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 0.88em;
  font-weight: 500;
}

/* ── Blockquotes ──────────────────────────────────────── */
.rendered-markdown-container :deep(blockquote) {
  margin: 1.25em 0;
  padding: 0.1em 0 0.1em 0.75em;
  border-left: 3px solid var(--accent-border);
  background: var(--bg-hover);
  border-radius: 0 6px 6px 0;
  color: var(--text-muted);
}

.rendered-markdown-container :deep(blockquote p) {
  margin-bottom: 0.5em;
  color: var(--text-muted);
}

.rendered-markdown-container :deep(blockquote p:last-child) {
  margin-bottom: 0;
}

/* ── Tables ───────────────────────────────────────────── */
.rendered-markdown-container :deep(.table-scroll-wrapper) {
  overflow-x: auto;
  margin: 1.5em 0;
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar) transparent;
}

.rendered-markdown-container :deep(.table-scroll-wrapper)::-webkit-scrollbar {
  height: 4px;
}

.rendered-markdown-container
  :deep(.table-scroll-wrapper)::-webkit-scrollbar-thumb {
  background: var(--scrollbar);
  border-radius: 2px;
}

.rendered-markdown-container :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  background: transparent;
}

.rendered-markdown-container :deep(th) {
  color: var(--text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  text-align: left;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.rendered-markdown-container :deep(th:first-child) {
  padding-left: 16px;
}

.rendered-markdown-container :deep(th:last-child) {
  padding-right: 16px;
}

.rendered-markdown-container :deep(td) {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text);
}

.rendered-markdown-container :deep(td:first-child) {
  padding-left: 16px;
}

.rendered-markdown-container :deep(td:last-child) {
  padding-right: 16px;
}

.rendered-markdown-container :deep(tr:last-child td) {
  border-bottom: none;
}

.rendered-markdown-container :deep(tr:nth-child(even) td) {
  background: var(--bg-active);
}

.rendered-markdown-container :deep(tr:hover td) {
  background: var(--bg-hover);
}

/* ── KaTeX math ───────────────────────────────────────── */
.rendered-markdown-container :deep(.katex-display) {
  margin: 1.5em 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.5em 0;
}

/* ── Streaming cursor ─────────────────────────────────── */
@keyframes cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.streaming-cursor {
  display: inline-block;
  width: 1.5px;
  height: 14px;
  background: var(--accent);
  border-radius: 1px;
  margin-left: 2px;
  vertical-align: middle;
  animation: cursor-blink 0.9s ease-in-out infinite;
}

/* ── Copy button ──────────────────────────────────────── */
.copy-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  margin-top: 12px;
  font-size: 11px;
  font-family: var(--sans);
  font-weight: 500;
}

.copy-btn:hover {
  background: var(--bg-hover);
  color: var(--text-muted);
  border-color: var(--border);
}

.copy-btn svg {
  opacity: 0.7;
}
</style>
