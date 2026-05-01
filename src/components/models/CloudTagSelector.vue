<template>
  <BaseModal
    :show="isOpen"
    title="Select Cloud Version"
    @close="emit('close')"
    max-width="460px"
  >
    <div class="p-5">
      <p class="text-[13px] text-[var(--text-muted)] mb-4 leading-relaxed">
        Multiple cloud versions found for
        <span class="text-[var(--accent)] font-bold">{{ modelName }}</span
        >. Select the tag you want to use:
      </p>

      <div v-if="tags.length > 5" class="mb-4 relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search tags..."
          autofocus
          class="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-[13.5px] text-white focus:outline-none focus:border-[var(--accent)] transition-colors placeholder-[var(--text-dim)]"
        />
        <div
          class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]"
        >
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
      </div>

      <div
        v-if="tags.length === 0"
        class="py-12 text-center text-[var(--text-dim)] text-[13px] bg-black/5 rounded-2xl border border-dashed border-[var(--border)]"
      >
        No cloud tags available for this model
      </div>

      <div
        v-else
        class="max-h-[340px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar"
      >
        <button
          v-for="tag in filteredTags"
          :key="tag"
          @click="handleSelect(tag)"
          class="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] border border-[var(--border)] rounded-xl transition-all group active:scale-[0.99]"
        >
          <div class="flex items-center gap-3">
            <div
              class="w-2 h-2 rounded-full bg-[var(--accent-muted)] border border-[var(--accent)]/40 group-hover:bg-[var(--accent)] transition-colors"
            ></div>
            <span
              class="text-[13.5px] text-[var(--text)] font-medium group-hover:text-white transition-colors"
              >{{ tag }}</span
            >
          </div>
          <svg
            class="w-4 h-4 text-[var(--text-dim)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M5 12h14m-7-7l7 7-7 7" />
          </svg>
        </button>

        <div
          v-if="filteredTags.length === 0"
          class="py-12 text-center text-[var(--text-dim)] text-[13px]"
        >
          No tags matching your search
        </div>
      </div>
    </div>

    <template #footer>
      <button
        @click="emit('close')"
        class="px-5 py-2.5 text-[13px] font-medium text-[var(--text-muted)] hover:text-white transition-colors"
      >
        Cancel
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import BaseModal from "../shared/BaseModal.vue";

const props = defineProps<{
  modelName: string;
  tags: string[];
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "select", tag: string): void;
  (e: "close"): void;
}>();

const searchQuery = ref("");

const filteredTags = computed(() => {
  if (!searchQuery.value) return props.tags;
  return props.tags.filter((t) =>
    t.toLowerCase().includes(searchQuery.value.toLowerCase()),
  );
});

function handleSelect(tag: string) {
  emit("select", tag);
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #444;
}
</style>
