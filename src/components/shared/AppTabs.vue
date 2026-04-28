<template>
  <div
    class="app-tabs sticky top-0 z-40 border-b -mx-6 px-6 py-0 mb-4 select-none overflow-x-auto no-scrollbar"
  >
    <div class="flex items-center gap-0.5">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="$emit('update:modelValue', tab.id)"
        class="app-tab relative inline-flex items-center gap-1.5 px-3 pb-[9px] pt-[7px] rounded-t-md text-[13px] border-none cursor-pointer font-[inherit]"
        :class="modelValue === tab.id ? 'app-tab--active' : 'app-tab--inactive'"
      >
        <component
          v-if="tab.icon"
          :is="tab.icon"
          class="w-3.5 h-3.5"
          style="opacity: 0.8"
        />
        <span>{{ tab.name }}</span>

        <!-- Active indicator line -->
        <div
          v-if="modelValue === tab.id"
          class="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-sm"
          style="
            background: var(--accent);
            box-shadow: 0 -3px 10px rgba(74, 128, 208, 0.4);
          "
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from "vue";

interface Tab {
  id: string;
  name: string;
  icon?: Component;
}

defineProps<{
  modelValue: string;
  tabs: Tab[];
}>();

defineEmits(["update:modelValue"]);
</script>

<style scoped>
.app-tabs {
  background: var(--bg-glass);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-color: var(--border);
}

.app-tab {
  background: transparent;
  color: var(--text-dim);
  flex-shrink: 0;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.app-tab--active {
  color: var(--text);
  font-weight: 500;
  background: rgba(255, 255, 255, 0.04);
}

.app-tab--inactive:hover {
  color: var(--text-muted);
  background: var(--bg-hover);
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
