<template>
  <div class="search-sidebar" :class="{ 'search-sidebar--open': isOpen }">
    <div class="search-sidebar__header">
      <span class="search-sidebar__title">Search results</span>
      <button
        class="search-sidebar__close"
        @click="chatStore.closeSearchSidebar()"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="search-sidebar__content">
      <div v-for="(res, idx) in results" :key="idx" class="source-card">
        <div class="source-card__header">
          <div class="source-card__index">{{ idx + 1 }}</div>
          <img
            :src="getFavicon(res.url)"
            class="source-card__favicon"
            @error="handleFaviconError"
          />
          <span class="source-card__site">{{ getHostname(res.url) }}</span>
        </div>
        <a
          :href="res.url"
          target="_blank"
          rel="noopener noreferrer"
          class="source-card__title"
          >{{ res.title }}</a
        >
        <p class="source-card__snippet">{{ res.content }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useChatStore } from "../../stores/chat";

const chatStore = useChatStore();

const isOpen = computed(() => chatStore.streaming.sidebarOpen);
const results = computed(() => chatStore.streaming.activeSearchData);

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function getFavicon(url: string) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

function handleFaviconError(e: Event) {
  (e.target as HTMLImageElement).style.display = "none";
}
</script>

<style scoped>
.search-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 320px;
  background: var(--bg-surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: 1000;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--shadow-lg);
}

.search-sidebar--open {
  transform: translateX(0);
}

.search-sidebar__header {
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-sidebar__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.search-sidebar__close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.search-sidebar__close:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.search-sidebar__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.source-card {
  padding: 12px;
  background: var(--bg-active);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  transition: all 0.2s;
}

.source-card:hover {
  border-color: var(--accent-border);
  background: var(--bg-hover);
}

.source-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.source-card__index {
  width: 18px;
  height: 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
}

.source-card__favicon {
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

.source-card__site {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.source-card__title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
  text-decoration: none;
  margin-bottom: 6px;
  line-height: 1.4;
}

.source-card__title:hover {
  text-decoration: underline;
}

.source-card__snippet {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
