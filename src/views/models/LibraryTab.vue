<template>
  <div class="flex flex-col gap-8" role="tabpanel">
    <LibraryBrowser @select="$emit('select', $event)" />
  </div>
</template>

<script setup lang="ts">
import LibraryBrowser from "../../components/models/LibraryBrowser.vue";
import type { LibraryModel } from "../../types/models";

defineEmits<{
  (e: "select", model: LibraryModel): void;
}>();
</script>
