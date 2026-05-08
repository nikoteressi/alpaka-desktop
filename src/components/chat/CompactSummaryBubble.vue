<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../../stores/chat";
import { renderMarkdown } from "../../lib/markdown";
import type { Message } from "../../types/chat";

const props = defineProps<{
  message: Message;
  conversationId: string;
}>();

const chatStore = useChatStore();

const isExpanded = computed(() =>
  chatStore.showingHistory.has(props.conversationId),
);

const archivedMessages = computed(
  () => chatStore.archivedMessages[props.conversationId] ?? [],
);

const renderedSummary = computed(() => renderMarkdown(props.message.content));

function toggle() {
  void chatStore.toggleHistory(props.conversationId);
}
</script>

<template>
  <div class="flex flex-col gap-0">
    <!-- Archived history (shown when expanded) -->
    <div
      v-if="isExpanded && archivedMessages.length"
      class="flex flex-col opacity-60"
    >
      <div
        v-for="msg in archivedMessages"
        :key="msg.id"
        class="px-4 py-2 text-sm border-l-2 ml-2 my-0.5"
        :style="{ borderColor: 'var(--border-strong)' }"
        :class="{
          'text-right': msg.role === 'user',
          'text-left': msg.role !== 'user',
        }"
      >
        <span
          class="text-[10px] uppercase tracking-wide block mb-0.5"
          :style="{ color: 'var(--text-muted)' }"
        >
          {{ msg.role === "compact_summary" ? "Previous summary" : msg.role }}
        </span>
        <span
          class="whitespace-pre-wrap break-words"
          :style="{ color: 'var(--text-dim)' }"
          >{{ msg.content }}</span
        >
      </div>
    </div>

    <!-- Toggle bar -->
    <button
      @click="toggle"
      class="flex items-center gap-2 px-3 py-1.5 text-[11px] rounded transition-colors cursor-pointer w-full"
      :style="{ color: 'var(--text-muted)' }"
    >
      <svg
        class="w-3 h-3 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <span>Previous messages hidden</span>
      <span class="ml-auto">{{
        isExpanded ? "▴ Hide history" : "▾ Show history"
      }}</span>
    </button>

    <!-- Summary bubble -->
    <div
      class="flex flex-col gap-1 px-3 py-2.5 rounded-lg mx-2 mt-1"
      :style="{
        background: 'var(--bg-active)',
        border: '1px solid var(--border-subtle)',
      }"
    >
      <div
        class="flex items-center gap-1.5 text-[10px] uppercase tracking-wide mb-1"
        :style="{ color: 'var(--text-muted)' }"
      >
        <svg
          class="w-3 h-3 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <span>Conversation summary</span>
      </div>
      <div
        class="leading-relaxed text-sm"
        :style="{ color: 'var(--text)' }"
        v-html="renderedSummary"
      />
    </div>
  </div>
</template>
