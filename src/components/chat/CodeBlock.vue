<template>
  <div class="code-block-wrapper">
    <!-- Header -->
    <div class="code-header">
      <span class="lang-label">{{ language || "plaintext" }}</span>
      <button @click="copyCode" class="copy-button">
        <template v-if="copied">
          <svg
            class="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span class="status-text">Copied!</span>
        </template>
        <template v-else>
          <svg
            class="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy</span>
        </template>
      </button>
    </div>

    <!-- Code body -->
    <div
      class="code-body"
      :class="{ 'code-body--collapsed': shouldCollapse && isCollapsed }"
    >
      <div class="code-scroll scrollbar-custom">
        <div v-if="highlightedHtml" class="shiki-render-container">
          <div v-html="highlightedHtml" class="shiki-render"></div>
          <span v-if="isStreaming" class="code-cursor"></span>
        </div>
        <pre
          v-else
          class="fallback-code"
        ><code>{{ code || '// No content' }}<span v-if="isStreaming" class="code-cursor"></span></code></pre>
      </div>
      <div v-if="shouldCollapse && isCollapsed" class="collapse-fade"></div>
    </div>

    <!-- Collapse toggle -->
    <button
      v-if="shouldCollapse"
      class="collapse-button"
      @click="isCollapsed = !isCollapsed"
    >
      {{ isCollapsed ? `Show ${hiddenLineCount} more lines ↓` : "Show less ↑" }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from "vue";
import { highlight } from "../../lib/markdown";
import { useCopyToClipboard } from "../../composables/useCopyToClipboard";

const COLLAPSE_THRESHOLD = 40;
const COLLAPSED_LINE_COUNT = 25;

const props = defineProps<{
  code: string;
  language: string;
  isStreaming?: boolean;
}>();

const highlightedHtml = ref("");
const { copied, copy } = useCopyToClipboard(2000);
const isCollapsed = ref(true);

const lineCount = computed(() => props.code.split("\n").length);
const shouldCollapse = computed(
  () => lineCount.value > COLLAPSE_THRESHOLD && !props.isStreaming,
);
const hiddenLineCount = computed(() =>
  Math.max(0, lineCount.value - COLLAPSED_LINE_COUNT),
);

watch(shouldCollapse, (nowShouldCollapse) => {
  if (nowShouldCollapse) isCollapsed.value = true;
});

let highlightTimeout: ReturnType<typeof setTimeout> | null = null;

async function updateHighlight() {
  if (highlightTimeout) clearTimeout(highlightTimeout);
  highlightTimeout = setTimeout(async () => {
    if (props.code) {
      try {
        highlightedHtml.value = await highlight(props.code, props.language);
      } catch (err) {
        console.error("Failed to highlight code:", err);
        highlightedHtml.value = "";
      }
    } else {
      highlightedHtml.value = "";
    }
  }, 30);
}

async function copyCode() {
  await copy(props.code);
}

watch([() => props.code, () => props.language], updateHighlight, {
  immediate: false,
});
onMounted(() => updateHighlight());
onBeforeUnmount(() => {
  if (highlightTimeout) {
    clearTimeout(highlightTimeout);
    highlightTimeout = null;
  }
});
</script>

<style scoped>
.code-block-wrapper {
  margin: 1.25rem 0;
  border-radius: 8px;
  background: var(--bg-code);
  border: 1px solid var(--border-subtle);
  transition: border-color 0.2s ease;
}

.code-block-wrapper:hover {
  border-color: var(--border-strong);
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background: var(--bg-code-hdr);
  border-bottom: 1px solid var(--border-subtle);
}

.lang-label {
  font-size: 11px;
  font-family: var(--mono);
  font-weight: 500;
  color: var(--text-dim);
  text-transform: lowercase;
}

.copy-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 10px;
  font-family: var(--sans);
  color: var(--text-dim);
  transition: all 0.2s;
}

.copy-button:hover {
  color: var(--text-muted);
}

.icon {
  width: 12px;
  height: 12px;
}

.status-text {
  color: var(--success);
}

/* Code body */
.code-body {
  position: relative;
}

.code-body--collapsed {
  max-height: 390px;
  overflow: hidden;
}

.code-scroll {
  padding: 1rem;
  overflow-x: auto;
}

.collapse-fade {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(to bottom, transparent, var(--bg-code));
  pointer-events: none;
}

.fallback-code {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  font-family: var(--mono);
  color: var(--text-muted);
}

/* Collapse toggle button */
.collapse-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 8px;
  background: var(--bg-code-hdr);
  border: none;
  border-top: 1px solid var(--border-subtle);
  color: var(--text-dim);
  font-size: 11px;
  font-family: var(--mono);
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 0 0 8px 8px;
}

.collapse-button:hover {
  background: var(--bg-hover);
  color: var(--text-muted);
}

.shiki-render-container {
  display: flex;
  align-items: flex-end;
}

.shiki-render {
  flex: 1;
}

/* Custom Scrollbar */
.scrollbar-custom::-webkit-scrollbar {
  height: 6px;
}
.scrollbar-custom::-webkit-scrollbar-thumb {
  background: var(--scrollbar);
  border-radius: 10px;
}
.scrollbar-custom::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-hover);
}

/* Shiki Overrides */
:deep(.shiki-render pre) {
  margin: 0 !important;
  background: transparent !important;
  font-size: 13px !important;
  line-height: 1.6 !important;
  font-family: var(--mono) !important;
}

:deep(.shiki-render code) {
  counter-reset: line;
}

:deep(.shiki-render .line::before) {
  counter-increment: line;
  content: counter(line);
  display: inline-block;
  width: 1.5rem;
  margin-right: 1.25rem;
  text-align: right;
  color: var(--border-strong);
  user-select: none;
  font-size: 11px;
}

.code-cursor {
  display: inline-block;
  width: 1.5px;
  height: 14px;
  background: var(--accent);
  margin-left: 2px;
  vertical-align: middle;
  animation: cursor-blink 0.9s infinite;
}

@keyframes cursor-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
