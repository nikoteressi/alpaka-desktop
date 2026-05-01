<script setup lang="ts">
interface Attachment {
  previewUrl: string;
  // other fields like file, content but we only use previewUrl here
}

defineProps<{
  attachments: Attachment[];
}>();

defineEmits<{
  (e: "remove", index: number): void;
}>();
</script>

<template>
  <div v-if="attachments.length > 0" class="flex flex-wrap gap-2 mb-2">
    <div
      v-for="(file, index) in attachments"
      :key="index"
      class="relative group/img"
    >
      <img
        :src="file.previewUrl"
        alt=""
        class="h-14 w-14 object-cover rounded-lg border border-[var(--border-strong)] shadow-sm"
      />
      <button
        @click="$emit('remove', index)"
        class="absolute -top-1.5 -right-1.5 bg-[var(--bg-base)] text-[var(--text)] rounded-full p-1 opacity-0 group-hover/img:opacity-100 outline-none hover:bg-[var(--bg-hover)] transition shadow-md z-10 cursor-pointer"
      >
        <svg
          class="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
