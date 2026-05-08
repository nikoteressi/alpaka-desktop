<template>
  <aside
    class="flex flex-col h-full w-64 flex-shrink-0 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800"
  >
    <!-- New Chat -->
    <div class="flex-shrink-0 p-3">
      <button
        data-testid="new-chat-btn"
        class="w-full flex items-center justify-center gap-2.5 px-3 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
        @click="newChat"
      >
        <div class="flex items-center gap-2">
          <svg
            class="w-3.5 h-3.5 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span class="leading-none">New Chat</span>
        </div>
      </button>
    </div>

    <!-- Search -->
    <div class="flex-shrink-0 px-3 pb-2">
      <div class="relative">
        <svg
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Search..."
          class="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 placeholder-neutral-400 text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-orange-400 transition"
        />
      </div>
    </div>

    <!-- List -->
    <ConversationList class="flex-1" />
  </aside>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ConversationList from "./ConversationList.vue";
import { useConversationLifecycle } from "../../composables/useConversationLifecycle";

const { createConversation } = useConversationLifecycle();
const search = ref("");

async function newChat() {
  await createConversation();
}
</script>
