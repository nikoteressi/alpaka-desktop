<template>
  <div class="settings-row">
    <div class="flex items-start gap-3 min-w-0">
      <div v-if="icon" class="row-icon">
        <slot name="icon">
          <!-- Default icons if simple string name provided -->
          <svg
            v-if="icon === 'cloud'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-14 0h0a7 7 0 0 0 5 6.7"
            />
          </svg>
          <svg
            v-else-if="icon === 'download'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <svg
            v-else-if="icon === 'activity'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <svg
            v-else-if="icon === 'bell'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <svg
            v-else-if="icon === 'wifi'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.59 16.11a6 6 0 0 1 6.82 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <svg
            v-else-if="icon === 'folder'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            />
          </svg>
          <svg
            v-else-if="icon === 'database'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5V19A9 3 0 0 0 21 19V5" />
            <path d="M3 12A9 3 0 0 0 21 12" />
          </svg>
          <svg
            v-else-if="icon === 'layout'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <svg
            v-else-if="icon === 'globe'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path
              d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
            />
          </svg>
          <svg
            v-else-if="icon === 'sliders'"
            class="w-[14px] h-[14px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="2" y1="14" x2="6" y2="14" />
            <line x1="10" y1="8" x2="14" y2="8" />
            <line x1="18" y1="16" x2="22" y2="16" />
          </svg>
        </slot>
      </div>
      <div class="min-w-0">
        <p class="row-label">
          <slot name="label">{{ label }}</slot>
        </p>
        <p v-if="$slots.subtitle || subtitle" class="row-subtitle">
          <slot name="subtitle">{{ subtitle }}</slot>
        </p>
      </div>
    </div>
    <div class="flex-shrink-0 flex items-center gap-2">
      <slot name="control" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon?: string;
  label?: string;
  subtitle?: string;
}>();
</script>

<style scoped>
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  gap: 12px;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.settings-row:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.row-icon {
  margin-top: 1px;
  flex-shrink: 0;
  color: var(--text-muted);
}

.row-label {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.4;
}

.row-subtitle {
  font-size: 11.5px;
  margin-top: 2px;
  color: var(--text-dim);
  line-height: 1.4;
}
</style>
