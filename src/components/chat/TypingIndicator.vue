<script setup lang="ts">
// TypingIndicator — shown while waiting for the first token from the assistant
</script>

<template>
  <div
    style="
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: var(--bg-surface);
      border: 1px solid var(--border-muted);
      border-radius: 99px;
      padding: 8px 16px;
    "
  >
    <span
      class="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce"
      style="animation-delay: 0ms"
    />
    <span
      class="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce"
      style="animation-delay: 150ms"
    />
    <span
      class="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce"
      style="animation-delay: 300ms"
    />
  </div>
</template>
