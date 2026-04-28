<template>
  <div style="margin-bottom: 12px;">
    <button
      @click="toggle"
      style="display: flex; align-items: center; gap: 6px; background: none; border: none; color: var(--text-muted); font-size: 13px; cursor: pointer; padding: 2px 0; font-family: inherit;"
    >
      <svg
        width="11" height="11" viewBox="0 0 12 12"
        fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
        :style="{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }"
      >
        <path d="M4 2l4 4-4 4"/>
      </svg>
      <span>{{ label }}</span>
      <span v-if="isThinking" class="think-pulse-dot" />
    </button>

    <!-- Grid accordion wrapper -->
    <div class="think-accordion" :class="{ 'think-accordion--closed': !isExpanded }">
      <div class="think-accordion__inner">
        <!-- Streaming: plain text (safe, no markdown parsing on partial content) -->
        <div
          v-if="isThinking"
          ref="contentEl"
          class="think-content think-content--plain"
          style="max-height: 380px;"
        >{{ content }}<span class="think-cursor" /></div>

        <!-- Finished: render as markdown -->
        <div
          v-else
          class="think-content think-content--rendered"
          style="max-height: 380px;"
          v-html="renderedContent"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useCollapsibleState } from '../../composables/useCollapsibleState'
import { renderMarkdown } from '../../lib/markdown'

const props = defineProps<{
  content: string
  isThinking: boolean
  thinkTime?: number | null
  messageKey?: string
}>()

const { isOpen, toggle: _toggle, setOpen } = useCollapsibleState({
  messageKey: props.messageKey,
  initialOpen: props.isThinking,
})

const isExpanded = computed(() => isOpen.value)
const contentEl = ref<HTMLElement | null>(null)

const label = computed(() => {
  if (props.isThinking) return 'Thinking...'
  const t = props.thinkTime
  if (t !== null && t !== undefined && !isNaN(t)) {
    return `Thought for ${t.toFixed(1)} seconds`
  }
  return 'Thoughts'
})

const renderedContent = computed(() => renderMarkdown(props.content))

function toggle(event: MouseEvent) {
  event.stopPropagation()
  _toggle()
}

watch(() => props.content, async () => {
  if (!props.isThinking || !isOpen.value) return
  await nextTick()
  if (contentEl.value) {
    contentEl.value.scrollTop = contentEl.value.scrollHeight
  }
})

watch(() => props.isThinking, (isNow, wasBefore) => {
  if (wasBefore && !isNow) setOpen(false)
})

defineExpose({ isOpen })
</script>

<style scoped>
.think-accordion {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.25s ease;
}

.think-accordion--closed {
  grid-template-rows: 0fr;
}

.think-accordion__inner {
  overflow: hidden;
}

/* Shared content container */
.think-content {
  margin-top: 8px;
  padding: 12px 16px;
  background: var(--bg-active);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  overflow-y: auto;
  text-align: left;
  font-family: var(--sans);
}

/* Plain text variant (while streaming) */
.think-content--plain {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
  white-space: pre-wrap;
}

.think-content--rendered :deep(.table-scroll-wrapper) {
  overflow-x: auto;
  margin: 0.75em 0;
}

/* Rendered markdown variant (after thinking ends) */
.think-content--rendered {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.6;
}

.think-content--rendered :deep(p) {
  margin: 0 0 0.75em;
  color: var(--text-muted);
}

.think-content--rendered :deep(p:last-child) {
  margin-bottom: 0;
}

.think-content--rendered :deep(ul),
.think-content--rendered :deep(ol) {
  margin: 0 0 0.75em;
  padding-left: 1.4em;
}

.think-content--rendered :deep(li) {
  margin-bottom: 0.2em;
  color: var(--text-muted);
}

.think-content--rendered :deep(strong) {
  color: var(--text-muted);
  font-weight: 600;
}

.think-content--rendered :deep(h1),
.think-content--rendered :deep(h2),
.think-content--rendered :deep(h3) {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin: 0.75em 0 0.4em;
}

.think-content--rendered :deep(code:not(pre code)) {
  background: var(--bg-elevated);
  color: var(--text-muted);
  padding: 1px 4px;
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 0.87em;
}

.think-content--rendered :deep(pre) {
  background: var(--bg-active);
  border-radius: 8px;
  padding: 0.75em 1em;
  overflow-x: auto;
  margin: 0.5em 0;
}

.think-content--rendered :deep(pre code) {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-muted);
  background: none;
  padding: 0;
}

/* Animations */
@keyframes think-pulse {
  0%, 100% { opacity: 0.3; transform: scale(0.8); }
  50%       { opacity: 1;   transform: scale(1);   }
}

@keyframes think-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.think-pulse-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: think-pulse 1.2s ease-in-out infinite;
  flex-shrink: 0;
}

.think-cursor {
  display: inline-block;
  width: 2px;
  height: 13px;
  background: var(--text-muted);
  border-radius: 1px;
  margin-left: 2px;
  vertical-align: middle;
  animation: think-blink 0.8s step-end infinite;
}
</style>
