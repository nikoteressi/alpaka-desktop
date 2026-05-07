<template>
  <div
    class="search-block"
    :class="{
      'search-block--found': type === 'found',
      'search-block--final': type === 'final',
      'search-block--streaming': isStreaming,
    }"
  >
    <button
      class="search-badge"
      :class="{ 'search-badge--active': isActive }"
      @click="handleToggle"
    >
      <div v-if="type === 'found'" class="search-badge__icon">
        <svg
          v-if="isStreaming && state === 'reading'"
          class="animate-spin"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
        >
          <circle cx="12" cy="12" r="10" stroke-opacity="0.2" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <svg
          v-else
          width="14"
          height="14"
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
      </div>

      <div class="search-badge__content">
        <!-- For Final, favicons go first, no search icon -->
        <template v-if="type === 'final'">
          <div v-if="favicons.length > 0" class="search-badge__favicons">
            <div
              v-for="(src, idx) in favicons.slice(0, 4)"
              :key="idx"
              class="favicon-stack-item"
              :style="{
                zIndex: 10 - idx,
                marginLeft: idx === 0 ? '0' : '-6px',
              }"
            >
              <img
                :src="src"
                class="search-badge__favicon"
                @error="handleFaviconError"
              />
            </div>
          </div>
          <span class="search-badge__text">{{ label }}</span>
        </template>

        <!-- For Found, text goes first -->
        <template v-else>
          <span class="search-badge__text">{{ label }}</span>
          <div v-if="favicons.length > 0" class="search-badge__favicons">
            <div
              v-for="(src, idx) in favicons.slice(0, 4)"
              :key="idx"
              class="favicon-stack-item"
              :style="{
                zIndex: 10 - idx,
                marginLeft: idx === 0 ? '0' : '-6px',
              }"
            >
              <img
                :src="src"
                class="search-badge__favicon"
                @error="handleFaviconError"
              />
            </div>
          </div>
        </template>
      </div>

      <div v-if="type === 'final'" class="search-badge__chevron">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../../stores/chat";
import type { SearchResult } from "../../types/chat";

const props = defineProps<{
  type: "found" | "final";
  messageId?: string;
  query?: string;
  results?: SearchResult[];
  state?: "found" | "reading" | "done";
  isStreaming?: boolean;
}>();

const chatStore = useChatStore();

const isActive = computed(() => {
  return (
    chatStore.streaming.sidebarOpen &&
    chatStore.streaming.activeSearchMessageId === props.messageId
  );
});

const label = computed(() => {
  const count = props.results?.length || 0;
  if (props.type === "found") {
    if (props.state === "reading") return `Searching web...`;
    return `Found ${count} web pages`;
  }
  return `${count} web pages`;
});

const favicons = computed(() => {
  if (!props.results) return [];
  const seen = new Set<string>();
  return props.results
    .map((r) => {
      try {
        const url = new URL(r.url);
        if (seen.has(url.hostname)) return null;
        seen.add(url.hostname);
        return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as string[];
});

function handleToggle() {
  if (isActive.value) {
    chatStore.closeSearchSidebar();
  } else {
    chatStore.openSearchSidebar(props.messageId || null, props.results || []);
  }
}

function handleFaviconError(e: Event) {
  const parent = (e.target as HTMLImageElement).parentElement;
  if (parent) parent.style.display = "none";
}
</script>

<style scoped>
.search-block {
  margin: 4px 0;
}

.search-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--bg-surface);
  border: 1px solid transparent;
  border-radius: 99px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  color: var(--text-muted);
}

.search-block--found {
  position: relative;
  z-index: 5;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.search-block--found .search-badge {
  background: transparent;
  padding: 4px 0;
  gap: 12px;
  position: relative;
  border: 1px solid transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
}

.search-block--found .search-badge__icon {
  position: absolute;
  left: -20.5px;
  transform: translateX(-50%); /* Perfectly center a 14px icon on the line */
  width: 14px;
  height: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--bg-surface);
  color: var(--accent);
  border-radius: 50%;
  z-index: 10;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 0 2px var(--bg-chat); /* Mask the line behind it */
}

.search-block--found .search-badge:hover {
  background: var(--bg-hover);
  padding: 4px 12px;
  padding-left: 32px; /* Space for the icon */
  margin-left: -12px;
  border-color: var(--border-muted);
  border-radius: 99px;
}

.search-block--found .search-badge:hover .search-badge__icon {
  left: 12px;
  transform: none;
  box-shadow: none;
}

.search-block--final .search-badge {
  background: rgba(var(--bg-elevated-rgb), 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-strong);
}

.search-badge:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
  color: var(--text);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-badge--active {
  border-color: var(--accent);
  background: var(--accent-muted);
  color: var(--accent);
}

.search-badge__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.search-badge__content {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 500;
}

.search-badge__favicons {
  display: flex;
  align-items: center;
}

.favicon-stack-item {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border-muted);
}

.search-badge__favicon {
  width: 11px;
  height: 11px;
  object-fit: contain;
}

.search-badge__chevron {
  opacity: 0.4;
  margin-left: 2px;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
