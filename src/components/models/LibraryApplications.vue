<template>
  <div v-if="apps && apps.length > 0" class="flex flex-col gap-4">
    <div
      class="text-[12px] font-bold text-[var(--text-dim)] uppercase tracking-widest px-1"
    >
      Applications
    </div>
    <div
      class="bg-[var(--bg-surface)] border border-[var(--border)] rounded-[14px] divide-y divide-[var(--border-subtle)] overflow-hidden shadow-sm"
    >
      <div
        v-for="app in apps"
        :key="app.name"
        class="flex items-center justify-between px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors group"
      >
        <div class="flex items-center gap-4 min-w-0">
          <div
            class="w-10 h-10 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden flex-shrink-0"
          >
            <img
              :src="app.icon_url"
              class="w-7 h-7 object-contain"
              :alt="app.name"
              @error="handleIconError"
            />
          </div>
          <div class="flex flex-col min-w-0">
            <span class="text-[13.5px] font-semibold text-[var(--text)]">{{
              app.name
            }}</span>
            <code
              class="text-[11.5px] font-mono text-[var(--text-dim)] truncate"
              >{{ app.command }}</code
            >
          </div>
        </div>
        <button
          @click="onCopy(app.command)"
          class="p-2 text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-base)] rounded-lg transition-all opacity-0 group-hover:opacity-100"
          title="Copy command"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LaunchApp } from "../../types/models";
import { copyToClipboard } from "../../lib/clipboard";

defineProps<{
  apps: LaunchApp[];
}>();

async function onCopy(command: string) {
  const success = await copyToClipboard(command);
  if (success) {
    // Optionally trigger a brief 'Copied!' state here
  }
}

function handleIconError(e: Event) {
  const target = e.target as HTMLImageElement;
  // Fallback to a generic icon if the remote one fails
  target.style.display = "none";
}
</script>
