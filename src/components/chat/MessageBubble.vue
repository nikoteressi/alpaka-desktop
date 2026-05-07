<script setup lang="ts">
import { ref, computed } from "vue";
import { renderMarkdown } from "../../lib/markdown";
import type { Message, MessagePart } from "../../types/chat";
import { useChatStore } from "../../stores/chat";
import ThinkBlock from "./ThinkBlock.vue";
import CodeBlock from "./CodeBlock.vue";
import SearchBlock from "./SearchBlock.vue";
import StatsBlock from "./StatsBlock.vue";
import MessageActions from "./MessageActions.vue";
import TypingIndicator from "./TypingIndicator.vue";
import { useSettingsStore } from "../../stores/settings";
import { uint8ArrayToBase64 } from "../../stores/chat";
import { parseMessageParts } from "../../lib/messageParser";
import { useVersionSwitcher } from "../../composables/useVersionSwitcher";

const props = defineProps<{
  message: Message;
  messageId?: string;
  isStreaming?: boolean;
  thinkingContent?: string;
  isThinking?: boolean;
  tokensPerSec?: number | null;
  siblingCount?: number;
  siblingOrder?: number;
  parentId?: string | null;
  isRegenerating?: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  regenerate: [messageId: string];
}>();

const chatStore = useChatStore();
const settingsStore = useSettingsStore();
const isUser = computed(() => props.message.role === "user");

const { hasPrev, hasNext, versionLabel, prevVersion, nextVersion } =
  useVersionSwitcher(props.message);

function onRegenerate() {
  emit("regenerate", props.message.id ?? "");
}

// Memoization cache for finished messages
const _parsedCache = ref<{ key: string; result: MessagePart[] } | null>(null);

const staticParts = computed(() => {
  if (props.isStreaming) return null;
  const cacheKey = `${props.message.content.length}:${props.message.content.slice(0, 32)}`;
  if (_parsedCache.value?.key === cacheKey) return _parsedCache.value.result;
  const result = parseMessageParts(props.message.content, {
    renderMarkdown,
    isUserMessage: isUser.value,
  });
  _parsedCache.value = { key: cacheKey, result };
  return result;
});

const displayParts = computed(() => {
  if (props.isStreaming) {
    return chatStore.streaming.activeMessageParts;
  }
  return staticParts.value || [];
});

// Unified Grouping Logic: sequential think/tool parts go together
const unifiedGroups = computed(() => {
  const parts = displayParts.value;
  const groups: Array<{ type: "thought" | "content"; parts: MessagePart[] }> =
    [];

  for (const part of parts) {
    const isThoughtRelated = part.type === "think" || part.type === "tool";
    const lastGroup = groups[groups.length - 1];

    if (isThoughtRelated) {
      if (lastGroup && lastGroup.type === "thought") {
        lastGroup.parts.push(part);
      } else {
        groups.push({ type: "thought", parts: [part] });
      }
    } else {
      groups.push({ type: "content", parts: [part] });
    }
  }
  return groups;
});

// Detect if any search results exist in the message for the final badge
const finalSearchResults = computed(() => {
  if (props.isStreaming) return chatStore.streaming.searchResults;
  const toolParts = displayParts.value.filter(
    (p) => p.type === "tool" && p.toolName === "web_search",
  );
  if (toolParts.length === 0) return [];
  return toolParts[toolParts.length - 1].toolResults || [];
});

function isThoughtGroupVisible(
  group: { parts: MessagePart[] },
  gIdx: number,
): boolean {
  return (
    group.parts.some((p) => p.content.trim().length > 0 || p.type === "tool") ||
    (!!props.isStreaming &&
      gIdx === unifiedGroups.value.length - 1 &&
      !!chatStore.streaming.thinkingBuffer)
  );
}

function thinkTimeForGroup(group: { parts: MessagePart[] }): number | null {
  const total = group.parts.reduce((acc, p) => acc + (p.thinkDuration ?? 0), 0);
  return total > 0 ? total : null;
}
</script>

<template>
  <!-- User Message -->
  <article v-if="isUser" class="user-message group">
    <div class="user-bubble-container relative">
      <div v-if="!isRegenerating" class="user-bubble">
        <div
          v-if="message.images && message.images.length > 0"
          class="flex flex-wrap gap-2 mb-2"
        >
          <img
            v-for="(img, idx) in message.images"
            :key="idx"
            :src="`data:image/png;base64,${uint8ArrayToBase64(img)}`"
            class="max-h-64 max-w-full rounded-lg border border-[var(--border-strong)]"
          />
        </div>
        {{ message.content }}
      </div>
      <div v-else class="text-xs text-neutral-500 italic">Regenerating…</div>
      <div
        v-if="!isStreaming"
        class="user-footer-actions opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      >
        <MessageActions
          :message="message"
          :is-user="true"
          mode="all"
          @edit="emit('edit')"
        />
        <div
          v-if="versionLabel !== null"
          class="flex items-center gap-1 text-xs text-neutral-400 mt-1 justify-end"
        >
          <button
            :disabled="!hasPrev"
            class="px-1 py-0.5 rounded hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            @click="prevVersion"
          >&lt;</button>
          <span>{{ versionLabel }}</span>
          <button
            :disabled="!hasNext"
            class="px-1 py-0.5 rounded hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            @click="nextVersion"
          >&gt;</button>
        </div>
      </div>
    </div>
  </article>

  <!-- Assistant Message -->
  <article
    v-else
    class="assistant-message group"
    :class="{ 'assistant-message--streaming': isStreaming }"
  >
    <!-- Version switcher at the top right -->
    <div
      v-if="!isStreaming"
      class="assistant-header-actions opacity-0 group-hover:opacity-100 transition-opacity duration-300"
    >
      <MessageActions :message="message" :is-user="false" mode="version-only" />
    </div>

    <div v-if="isRegenerating" class="text-xs text-neutral-500 italic py-2">Regenerating…</div>

    <div v-else class="assistant-content rendered-markdown-container">
      <template v-for="(group, gIdx) in unifiedGroups" :key="gIdx">
        <ThinkBlock
          v-if="group.type === 'thought' && isThoughtGroupVisible(group, gIdx)"
          :parts="group.parts"
          :is-thinking="
            isStreaming &&
            gIdx === unifiedGroups.length - 1 &&
            chatStore.streaming.isThinking
          "
          :is-overall-streaming="
            isStreaming && gIdx === unifiedGroups.length - 1
          "
          :think-time="thinkTimeForGroup(group)"
          :message-id="messageId"
          :message-key="
            messageId
              ? `${messageId}-thought-${gIdx}`
              : `thought-stable-${gIdx}`
          "
        />

        <template v-else-if="group.type === 'content'">
          <template v-for="(part, pIdx) in group.parts" :key="pIdx">
            <div
              v-if="part.type === 'markdown'"
              class="rendered-markdown"
              :class="{
                'rendered-markdown--streaming':
                  isStreaming &&
                  gIdx === unifiedGroups.length - 1 &&
                  pIdx === group.parts.length - 1 &&
                  !chatStore.streaming.isThinking,
              }"
              v-html="
                isStreaming ? renderMarkdown(part.content) : part.rendered
              "
            ></div>
            <CodeBlock
              v-else-if="part.type === 'code'"
              :code="part.content"
              :language="part.language || ''"
              :is-streaming="isStreaming"
            />
          </template>
        </template>
      </template>
    </div>

    <TypingIndicator v-if="isStreaming && displayParts.length === 0" />

    <!-- Final Search Badge & Stats & Actions -->
    <div v-if="!isStreaming && !isRegenerating" class="assistant-footer">
      <SearchBlock
        v-if="finalSearchResults.length > 0"
        type="final"
        :message-id="messageId"
        :results="finalSearchResults"
      />

      <div class="assistant-footer__stats mt-3">
        <StatsBlock
          v-if="settingsStore.showPerformanceMetrics && message.tokens_per_sec"
          :metrics="{
            total_duration_ms: message.total_duration_ms,
            load_duration_ms: message.load_duration_ms,
            prompt_eval_duration_ms: message.prompt_eval_duration_ms,
            eval_duration_ms: message.eval_duration_ms,
          }"
          :tokens-per-sec="message.tokens_per_sec"
          :output-tokens="message.tokens || 0"
          :input-tokens="message.prompt_tokens || 0"
          :generation-time-ms="message.generation_time_ms || 0"
          :message-key="messageId"
          :seed="message.seed"
          class="w-full"
        />
      </div>
      <div
        class="assistant-footer__actions opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      >
        <MessageActions
          :message="message"
          :is-user="false"
          mode="actions-only"
          @regenerate="onRegenerate"
        />
        <div
          v-if="versionLabel !== null"
          class="flex items-center gap-1 text-xs text-neutral-400 mt-1"
        >
          <button
            :disabled="!hasPrev"
            class="px-1 py-0.5 rounded hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            @click="prevVersion"
          >&lt;</button>
          <span>{{ versionLabel }}</span>
          <button
            :disabled="!hasNext"
            class="px-1 py-0.5 rounded hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            @click="nextVersion"
          >&gt;</button>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.user-message {
  display: flex;
  justify-content: flex-end;
  padding: 12px 24px 32px; /* More space at bottom for actions */
  position: relative;
}

.user-bubble-container {
  max-width: 70%;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.user-footer-actions {
  position: absolute;
  bottom: -28px;
  right: 0;
  z-index: 20;
}

.user-bubble {
  background: var(--bg-user-msg);
  border-radius: 18px;
  border-top-right-radius: 4px;
  padding: 8px 14px;
  font-size: 14px;
  color: var(--text);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid var(--border-subtle);
}

.assistant-message {
  padding: 12px 24px 24px;
  position: relative;
  max-width: 100%;
}

.assistant-header-actions {
  position: absolute;
  top: 12px;
  right: 24px;
  z-index: 20;
}

.assistant-footer {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.assistant-footer__stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.assistant-footer__actions {
  margin-top: 4px;
}

.rendered-markdown--streaming :deep(p:last-child),
.rendered-markdown--streaming :deep(li:last-child),
.rendered-markdown--streaming :deep(h1:last-child),
.rendered-markdown--streaming :deep(h2:last-child),
.rendered-markdown--streaming :deep(h3:last-child) {
  display: inline; /* Make it inline so the cursor follows the text */
}

.rendered-markdown--streaming :deep(> *:last-child)::after {
  content: "";
  display: inline-block;
  width: 1.5px;
  height: 14px;
  background: var(--accent);
  margin-left: 2px;
  vertical-align: baseline;
  animation: cursor-blink 0.9s infinite;
  position: relative;
  top: 1px;
}

@keyframes cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.rendered-markdown-container :deep(pre) {
  display: none !important;
}

/* Citation Pills */
.rendered-markdown-container :deep(.citation-pill) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  background: var(--bg-active);
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 600;
  border-radius: 50%;
  margin: 0 2px;
  vertical-align: top;
  cursor: pointer;
  transition: all 0.2s;
}

.rendered-markdown-container :deep(.citation-pill:hover) {
  background: var(--accent-muted);
  border-color: var(--accent);
  color: var(--accent);
  transform: scale(1.1);
}
</style>
