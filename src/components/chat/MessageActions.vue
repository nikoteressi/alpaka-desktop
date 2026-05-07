<template>
  <div
    class="message-actions"
    :class="{
      'message-actions--user': isUser,
      'message-actions--actions-only': mode === 'actions-only',
    }"
  >
    <!-- Version Switcher (Branching) -->
    <div
      v-if="hasVersions && (mode === 'all' || mode === 'version-only')"
      class="action-group version-switcher"
    >
      <button class="action-btn" @click="$emit('prev-version')">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
        >
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <span class="version-label"
        >{{ currentVersion }} / {{ totalVersions }}</span
      >
      <button class="action-btn" @click="$emit('next-version')">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
        >
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>

    <!-- Main Actions -->
    <div
      v-if="mode === 'all' || mode === 'actions-only'"
      class="action-group main-actions-row"
    >
      <button
        v-if="isUser"
        class="action-btn"
        title="Edit"
        @click="$emit('edit')"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
          ></path>
          <path
            d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
          ></path>
        </svg>
      </button>

      <button
        class="action-btn"
        :title="copied ? 'Copied!' : 'Copy content'"
        @click="handleCopy"
      >
        <svg
          v-if="copied"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <svg
          v-else
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>

      <button
        v-if="!isUser"
        class="action-btn"
        title="Regenerate"
        @click="$emit('regenerate')"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M23 4v6h-6"></path>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { Message } from "../../types/chat";
import { useCopyToClipboard } from "../../composables/useCopyToClipboard";

const props = withDefaults(
  defineProps<{
    message: Message;
    isUser: boolean;
    mode?: "all" | "actions-only" | "version-only";
    currentVersion?: number;
    totalVersions?: number;
  }>(),
  {
    mode: "all",
    currentVersion: 1,
    totalVersions: 1,
  },
);

defineEmits(["regenerate", "edit", "prev-version", "next-version"]);

const { copied, copy } = useCopyToClipboard(1500);

const hasVersions = computed(
  () => props.totalVersions && props.totalVersions > 1,
);

async function handleCopy() {
  await copy(props.message.content);
}
</script>

<style scoped>
.message-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.version-switcher {
  background: rgba(var(--bg-elevated-rgb), 0.3);
  border: 1px solid var(--border-muted);
  border-radius: 99px;
  padding: 1px 6px;
  backdrop-filter: blur(4px);
}

.version-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-dim);
  min-width: 28px;
  text-align: center;
  letter-spacing: 0.05em;
}

.action-btn {
  background: none;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.action-btn[title="Copied!"] {
  color: var(--success);
}
</style>
