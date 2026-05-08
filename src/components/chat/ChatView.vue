<template>
  <div
    class="flex flex-col h-full overflow-hidden bg-[var(--bg-chat)] relative"
  >
    <!-- Chat History / Scroll Area -->
    <div
      class="flex-1 overflow-y-auto w-full relative scroll-smooth"
      ref="scrollContainer"
      @scroll="onScroll"
    >
      <div class="max-w-4xl mx-auto w-full min-h-full pb-12 flex flex-col">
        <!-- System Instructions Header -->
        <div v-if="chatStore.activeSystemPrompt" class="px-4 pt-6 mb-2">
          <div
            class="bg-[var(--bg-surface)] border border-[var(--border-muted)] rounded-xl shadow-sm overflow-hidden"
          >
            <!-- Header row — always visible, click to toggle -->
            <button
              class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-chat)] transition-colors"
              @click="isSystemPromptExpanded = !isSystemPromptExpanded"
            >
              <div
                class="flex-shrink-0 p-1.5 bg-[var(--accent-muted)] rounded-lg"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4a80d0"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 20h9" />
                  <path
                    d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                  />
                </svg>
              </div>
              <span
                class="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider flex-1"
                >System Instructions</span
              >
              <!-- Collapsed preview -->
              <span
                v-if="!isSystemPromptExpanded"
                class="text-[12px] text-[var(--text-muted)] italic truncate max-w-xs opacity-60"
              >
                {{
                  chatStore.activeSystemPrompt.split("\n")[0].substring(0, 80)
                }}
              </span>
              <!-- Chevron -->
              <svg
                class="flex-shrink-0 w-3.5 h-3.5 text-[var(--text-muted)] transition-transform"
                :class="isSystemPromptExpanded ? 'rotate-180' : ''"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <!-- Expanded body -->
            <div v-if="isSystemPromptExpanded" class="px-4 pb-4">
              <div
                class="text-[13px] text-[var(--text-h)] leading-relaxed italic opacity-80 whitespace-pre-wrap"
              >
                {{ chatStore.activeSystemPrompt }}
              </div>
            </div>
          </div>
        </div>

        <DynamicScroller
          v-if="nonSystemMessages.length > 0"
          :items="itemsForScroller"
          :min-item-size="80"
          item-class="scroller-item"
          key-field="id"
          class="w-full"
        >
          <template #default="{ item, index, active }">
            <DynamicScrollerItem
              v-if="isScrollerItem(item)"
              :item="item"
              :active="active"
              :size-dependencies="[
                item.message.content,
                item.isStreaming,
                item.thinkingContent,
                item.isThinking,
                item.tokensPerSec,
                chatStore.expandedStats.has(item.id),
              ]"
              :data-index="index"
            >
              <MessageBubble
                :message="item.message"
                :message-id="item.id"
                :is-streaming="item.isStreaming"
                :thinking-content="item.thinkingContent"
                :is-thinking="item.isThinking"
                :tokens-per-sec="item.tokensPerSec"
                :class="item.outsideContext ? 'opacity-40' : ''"
              />
            </DynamicScrollerItem>
            <DynamicScrollerItem
              v-else-if="isBoundaryItem(item)"
              :item="item"
              :active="active"
            >
              <div class="flex items-center gap-3 py-3 px-6">
                <div class="flex-1 h-px bg-amber-500/25"></div>
                <span
                  class="text-[10px] text-amber-400/60 font-medium whitespace-nowrap select-none"
                >
                  ↑ Outside context window
                </span>
                <div class="flex-1 h-px bg-amber-500/25"></div>
              </div>
            </DynamicScrollerItem>
          </template>
        </DynamicScroller>

        <div v-else class="flex-1 flex flex-col items-center justify-center">
          <div class="w-32 h-32 flex items-center justify-center">
            <img
              src="../../assets/llama-main.png"
              alt="Ollama"
              class="w-full h-full object-contain themed-logo opacity-80"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Scroll to bottom button -->
    <transition name="fade">
      <button
        v-if="!isAutoScrollEnabled && messages.length > 0"
        @click="scrollToBottom()"
        class="absolute bottom-28 left-1/2 -translate-x-1/2 bg-[var(--bg-surface)] border border-[var(--border)] shadow-lg rounded-full px-4 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-h)] hover:bg-[var(--border-muted)] transition-colors cursor-pointer"
      >
        ↓ Jump to present
      </button>
    </transition>

    <!-- Model download progress banner -->
    <transition name="slide-up">
      <div
        v-if="activePullProgress"
        class="absolute bottom-[120px] left-1/2 -translate-x-1/2 w-full max-w-md z-30"
      >
        <div
          class="mx-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-4 py-3 shadow-[var(--shadow)]"
        >
          <div class="flex items-center gap-2.5 mb-2">
            <svg
              class="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" />
            </svg>
            <span class="text-[13px] text-[var(--text-h)] font-medium truncate"
              >Downloading {{ activePullProgress.model }}</span
            >
            <span
              class="text-[12px] text-[var(--text-muted)] ml-auto flex-shrink-0"
              >{{ activePullProgress.status }}</span
            >
          </div>
          <div class="h-1 bg-[var(--bg-chat)] rounded-full overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-[#4a80d0] to-[#6aa0f0] rounded-full transition-all duration-300"
              :style="{ width: activePullProgress.percent + '%' }"
            />
          </div>
          <div
            v-if="activePullProgress.percent > 0"
            class="text-[11px] text-[var(--text-muted)] mt-1 text-right"
          >
            {{ Math.round(activePullProgress.percent) }}%
          </div>
        </div>
      </div>
    </transition>

    <!-- Input Area -->
    <ChatInput
      :is-streaming="isStreamingForActiveChat"
      @send="onSend"
      @stop="onStop"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from "vue";
import { DynamicScroller, DynamicScrollerItem } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import MessageBubble from "./MessageBubble.vue";
import ChatInput from "./ChatInput.vue";
import { useChatStore } from "../../stores/chat";
import { useModelStore } from "../../stores/models";
import { useSettingsStore } from "../../stores/settings";
import { useAppOrchestration } from "../../composables/useAppOrchestration";
import { useSendMessage } from "../../composables/useSendMessage";
import type { Message } from "../../types/chat";
import type { ChatOptions } from "../../types/settings";

interface ScrollerItem {
  id: string;
  message: Message;
  isStreaming: boolean;
  thinkingContent: string;
  isThinking: boolean;
  tokensPerSec: number | null;
  outsideContext?: boolean;
}

interface BoundaryItem {
  id: string;
  type: "context-boundary";
}

/**
 * Type guard for the virtual scroller to narrow 'unknown' items to 'ScrollerItem'
 * without using 'any' in the template.
 */
function isScrollerItem(item: unknown): item is ScrollerItem {
  return !!item && typeof item === "object" && "message" in item;
}

function isBoundaryItem(item: unknown): item is BoundaryItem {
  return (
    !!item &&
    typeof item === "object" &&
    "type" in item &&
    (item as Record<string, unknown>).type === "context-boundary"
  );
}

const chatStore = useChatStore();
const modelStore = useModelStore();
const settingsStore = useSettingsStore();
const orchestration = useAppOrchestration();
const { sendMessage, stopGeneration } = useSendMessage();

const scrollContainer = ref<HTMLElement | null>(null);
const isAutoScrollEnabled = ref(true);
const isSystemPromptExpanded = ref(false);

const messages = computed(() => chatStore.activeMessages);
const nonSystemMessages = computed(() =>
  messages.value.filter((m) => m.role !== "system"),
);
const streaming = computed(() => chatStore.streaming);
/** Pull progress for the currently selected model in this chat */
const activePullProgress = computed(() => {
  const currentModel = chatStore.activeConversation?.model;
  if (!currentModel) return null;
  return modelStore.pulling[currentModel] || null;
});

/** Global streaming flag, now narrowed to the active chat for the ChatInput component */
const isStreamingForActiveChat = computed(
  () =>
    streaming.value.isStreaming &&
    streaming.value.currentConversationId === chatStore.activeConversationId,
);

// ---- Context boundary tracking ----
const activeModelName = computed(
  () => chatStore.activeConversation?.model ?? "",
);

const maxContextForBoundary = computed(() => {
  const globalSetting = settingsStore.chatOptions.num_ctx;
  const modelNative = modelStore.getCapabilities(
    activeModelName.value,
  )?.context_length;
  const effective = globalSetting ?? modelNative ?? 4096;
  return modelNative ? Math.min(effective, modelNative) : effective;
});

/**
 * Returns the index of the first message that is inside the context window
 * (reading newest-first). Messages before this index are outside the window.
 * Returns -1 if all messages fit (no boundary needed).
 */
const contextBoundaryIndex = computed(() => {
  const msgs = nonSystemMessages.value;
  const max = maxContextForBoundary.value;
  if (!msgs.length) return -1;

  let accumulated = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const tokens = msgs[i].tokens ?? Math.ceil(msgs[i].content.length / 4);
    accumulated += tokens;
    if (accumulated >= max) {
      return i; // messages before index i are outside context
    }
  }
  return -1; // all messages fit
});

// Optimized history mapping: only re-calculates when the message list itself changes,
// NOT on every token during streaming.
const pastMessageItems = computed<ScrollerItem[]>(() => {
  const boundary = contextBoundaryIndex.value;
  return nonSystemMessages.value.map((msg, index) => ({
    id: msg.id ? `dbmsg-${msg.id}` : `msg-${index}`,
    message: msg,
    isStreaming: false,
    thinkingContent: "",
    isThinking: false,
    tokensPerSec: msg.tokens_per_sec ?? null,
    outsideContext: boundary > 0 && index < boundary,
  }));
});

// Map standard messages + the currently streaming message for the scroller.
// Also injects a boundary divider at the context window cutoff.
const itemsForScroller = computed<(ScrollerItem | BoundaryItem)[]>(() => {
  const items: (ScrollerItem | BoundaryItem)[] = [...pastMessageItems.value];

  // Inject boundary marker before the first message inside the context window
  const boundaryIdx = contextBoundaryIndex.value;
  if (boundaryIdx > 0 && boundaryIdx < items.length) {
    items.splice(boundaryIdx, 0, {
      id: "context-boundary",
      type: "context-boundary",
    });
  }

  if (isStreamingForActiveChat.value) {
    items.push({
      id: "msg-streaming-active",
      message: {
        role: "assistant" as const,
        content: streaming.value.buffer,
        tokens: streaming.value.evalTokens,
        prompt_tokens: streaming.value.promptTokens,
        tokens_per_sec: streaming.value.tokensPerSec ?? 0,
        generation_time_ms: 0,
        total_duration_ms: 0,
        load_duration_ms: 0,
        prompt_eval_duration_ms: 0,
        eval_duration_ms: 0,
      },
      isStreaming: true,
      thinkingContent: streaming.value.thinkingBuffer,
      isThinking: streaming.value.isThinking,
      tokensPerSec: streaming.value.tokensPerSec,
    });
  }

  return items;
});

async function onSend(
  text: string,
  images?: Uint8Array[],
  webSearchEnabled?: boolean,
  thinkMode?: string,
  chatOptions?: ChatOptions,
) {
  isAutoScrollEnabled.value = true;
  await sendMessage(text, images, webSearchEnabled, thinkMode, chatOptions);
}

async function onStop() {
  await stopGeneration();
}

// Timer used to guard onScroll from re-disabling auto-scroll during a programmatic smooth scroll.
// Cleared either by scrollend event (preferred) or a 500ms fallback.
let _smoothScrollTimer: ReturnType<typeof setTimeout> | null = null;

function onScroll() {
  if (!scrollContainer.value) return;
  // Skip intermediate scroll events triggered by our own scrollToBottom('smooth') call.
  if (_smoothScrollTimer !== null) return;

  const el = scrollContainer.value;
  const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

  if (distanceToBottom > 100) {
    isAutoScrollEnabled.value = false;
  } else {
    isAutoScrollEnabled.value = true;
  }
}

/**
 * Scrolls the chat to the bottom.
 * @param behavior 'smooth' for user-triggered jump, 'auto' for immediate tracking during streaming.
 */
function scrollToBottom(behavior: ScrollBehavior = "smooth") {
  if (!scrollContainer.value) return;
  isAutoScrollEnabled.value = true;

  // nextTick + rAF ensures DynamicScroller has completed its ResizeObserver-driven layout
  // before we read scrollHeight, fixing the "0px scrollHeight on conversation open" bug.
  nextTick(() => {
    requestAnimationFrame(() => {
      if (!scrollContainer.value) return;
      const el = scrollContainer.value;
      el.scrollTo({ top: el.scrollHeight, behavior });

      if (behavior === "smooth") {
        // Guard onScroll for the duration of the animation. scrollend fires when the
        // browser finishes; the 500ms timer is a safety net for older WebKitGTK builds.
        if (_smoothScrollTimer) clearTimeout(_smoothScrollTimer);
        _smoothScrollTimer = setTimeout(() => {
          _smoothScrollTimer = null;
          onScroll();
        }, 500);
        el.addEventListener(
          "scrollend",
          () => {
            if (_smoothScrollTimer) {
              clearTimeout(_smoothScrollTimer);
              _smoothScrollTimer = null;
            }
            onScroll();
          },
          { once: true },
        );
      }
    });
  });
}

// Reset scroll state and collapse system prompt when switching conversations.
// Resetting isAutoScrollEnabled here ensures the itemsForScroller watcher below
// will scroll to bottom once the new conversation's messages arrive.
watch(
  () => chatStore.activeConversationId,
  () => {
    isSystemPromptExpanded.value = false;
    isAutoScrollEnabled.value = true;
  },
);

// Auto-scroll when new content arrives.
// flush: 'post' ensures we read scrollHeight after the DOM (including DynamicScroller) has updated.
watch(
  () => itemsForScroller.value,
  () => {
    if (isAutoScrollEnabled.value) {
      scrollToBottom("auto");
    }
  },
  { flush: "post" },
);

onMounted(async () => {
  await chatStore.loadConversations();

  if (!chatStore.activeConversationId && chatStore.conversations.length === 0) {
    orchestration.startNewChat();
  } else if (
    !chatStore.activeConversationId &&
    chatStore.conversations.length > 0
  ) {
    await chatStore.loadConversation(chatStore.conversations[0].id);
  }

  scrollToBottom();
});
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>
