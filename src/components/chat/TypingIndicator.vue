<script setup lang="ts">
// TypingIndicator — shown while waiting for the first token from the assistant
</script>

<template>
  <div
    style="
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #222;
      border-radius: 12px;
      padding: 10px 14px;
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
