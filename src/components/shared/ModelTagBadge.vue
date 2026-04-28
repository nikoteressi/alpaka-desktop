<template>
  <span :class="badgeClasses" :title="tag">{{ displayText }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  tag: string;
}>();

const tagConfig = computed(() => {
  const t = props.tag.toLowerCase();
  if (t === "vision") return { text: "Vision", cls: "tag-vision" };
  if (t === "tools") return { text: "Tools", cls: "tag-tools" };
  if (t === "thinking" || t === "think")
    return { text: "Think", cls: "tag-thinking" };
  if (t === "cloud") return { text: "Cloud", cls: "tag-cloud" };
  if (t === "embedding" || t === "embed")
    return { text: "Embed", cls: "tag-embedding" };
  if (t === "audio") return { text: "Audio", cls: "tag-audio" };
  if (/^\d+(\.\d+)?[bB]$/.test(props.tag))
    return { text: props.tag.toUpperCase(), cls: "tag-size" };
  return { text: props.tag, cls: "tag-generic" };
});

const displayText = computed(() => tagConfig.value.text);

// Uses global CSS classes defined in src/style.css — no scoped styles needed.
const badgeClasses = computed(() => ["model-tag", tagConfig.value.cls]);
</script>
