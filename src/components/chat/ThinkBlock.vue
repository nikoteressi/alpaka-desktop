<template>
  <div
    class="think-block"
    :class="{ 'think-block--streaming': isOverallStreaming }"
  >
    <button @click="toggle" class="think-header" :aria-expanded="isOpen">
      <div class="think-header__icon">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="brain-icon"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <span class="think-header__label">{{ label }}</span>
      <svg
        class="think-header__chevron"
        :style="{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <div
      class="think-accordion"
      :class="{ 'think-accordion--closed': !isOpen }"
    >
      <div class="think-accordion__inner">
        <div class="think-scroll-area" ref="scrollArea">
          <div class="think-timeline">
            <transition-group name="think-part-fade">
              <div v-for="(part, idx) in parts" :key="idx">
                <div v-if="part.type === 'think'">
                  <transition-group name="think-step-list">
                    <div
                      v-for="(step, sIdx) in stepsPerPart[idx]"
                      :key="`${idx}-${sIdx}`"
                      class="think-step"
                    >
                      <div class="think-step__marker">
                        <div class="think-step__dot"></div>
                      </div>
                      <div
                        class="think-step__content"
                        style="display: inline-block; width: 100%"
                      >
                        <span
                          v-if="isThinking && idx === parts.length - 1"
                          ref="contentEl"
                          class="think-step__active"
                          >{{ step
                          }}<span
                            v-if="sIdx === stepsPerPart[idx].length - 1"
                            class="think-cursor"
                          ></span
                        ></span>
                        <div v-else v-html="renderMarkdown(step)"></div>
                      </div>
                    </div>
                  </transition-group>
                </div>
                <div
                  v-else-if="
                    part.type === 'tool' && part.toolName === 'web_search'
                  "
                >
                  <!-- Case 1: Search is in progress (not done yet) -->
                  <div v-if="!part.isDone" class="think-step think-step--pulse">
                    <div class="think-step__marker">
                      <div class="think-step__dot"></div>
                    </div>
                    <div class="think-step__content">
                      <span class="think-step__analyzing"
                        >Searching web for "{{ part.toolQuery }}"...</span
                      >
                    </div>
                  </div>

                  <!-- Case 2: Search is done -->
                  <template v-else>
                    <div
                      v-if="part.toolResults && part.toolResults.length > 0"
                      class="think-timeline-tool"
                    >
                      <SearchBlock
                        type="found"
                        :message-id="messageId"
                        :query="part.toolQuery"
                        :results="part.toolResults"
                        state="done"
                      />
                    </div>
                    <!-- Bridge: Analyzing pulse only shows up AFTER search is finished -->
                    <div
                      v-if="isOverallStreaming && idx === parts.length - 1"
                      class="think-step think-step--pulse"
                    >
                      <div class="think-step__marker">
                        <div class="think-step__dot"></div>
                      </div>
                      <div class="think-step__content">
                        <span class="think-step__analyzing"
                          >Analyzing results...</span
                        >
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </transition-group>
            <!-- Live Streaming tool -->
            <div v-if="$slots['streaming-tool']" class="think-timeline-tool">
              <slot name="streaming-tool"></slot>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useCollapsibleState } from "../../composables/useCollapsibleState";
import { renderMarkdown } from "../../lib/markdown";
import SearchBlock from "./SearchBlock.vue";
import type { MessagePart } from "../../types/chat";

const props = defineProps<{
  parts: MessagePart[];
  isThinking: boolean;
  isOverallStreaming?: boolean;
  thinkTime?: number | null;
  messageId?: string;
  messageKey?: string;
}>();

const { isOpen, toggle: _toggle } = useCollapsibleState({
  messageKey: props.messageKey,
  initialOpen: true,
});

const contentEl = ref<HTMLElement | null>(null);
const scrollArea = ref<HTMLElement | null>(null);

const label = computed(() => {
  if (props.isOverallStreaming) {
    const lastPart = props.parts[props.parts.length - 1];
    const hasToolCall = props.parts.some((p) => p.type === "tool");

    if (lastPart && lastPart.type === "tool") {
      return lastPart.isDone ? "Analyzing results..." : "Searching web...";
    }

    if (props.isThinking && hasToolCall) {
      const content = lastPart?.content || "";
      if (content.length < 50) return "Analyzing results...";
      return "Thinking...";
    }

    if (
      props.isThinking &&
      lastPart &&
      lastPart.type === "think" &&
      lastPart.content
    ) {
      const lastLines = lastPart.content.trim().split("\n");
      const currentLine = lastLines[lastLines.length - 1].toLowerCase();
      if (
        !hasToolCall &&
        (currentLine.includes("search") || currentLine.includes("look up"))
      ) {
        return "Searching...";
      }
      if (currentLine.includes("plan") || currentLine.includes("step"))
        return "Planning...";
      if (currentLine.includes("calculat")) return "Calculating...";
      if (currentLine.includes("verif") || currentLine.includes("check"))
        return "Verifying...";
    }
    return "Thinking...";
  }

  const t = props.thinkTime;
  if (t !== null && t !== undefined && !Number.isNaN(t)) {
    return `Thought for ${Math.round(t)} seconds`;
  }
  return "Thought";
});

function getSteps(content: string): string[] {
  const trimmed = content.trim();
  if (!trimmed && props.isThinking) return [""];
  const steps = trimmed
    .split(/\n\n|\n(?=\d+\.\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (steps.length === 0 && props.isThinking) return [""];
  return steps;
}

// Pre-computes steps per think-part once per reactive update — avoids calling
// getSteps twice per step in the template (once for iteration, once for last-index check).
const stepsPerPart = computed(() =>
  props.parts.map((p) => (p.type === "think" ? getSteps(p.content) : [])),
);

function toggle(event: MouseEvent) {
  event.stopPropagation();
  _toggle();
}

let lastScrollTime = 0;
watch(
  () => props.parts.reduce((sum, p) => sum + p.content.length, 0),
  async () => {
    if (!props.isThinking || !isOpen.value) return;
    const now = Date.now();
    if (now - lastScrollTime < 100) return;
    lastScrollTime = now;
    await nextTick();
    if (scrollArea.value) {
      scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
    }
  },
);

let collapseTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.isThinking,
  (isThinking) => {
    if (collapseTimer) clearTimeout(collapseTimer);

    if (!isThinking && isOpen.value) {
      // Small delay to let the user see it finished before collapsing
      collapseTimer = setTimeout(() => {
        // Only auto-collapse if we are in a finished state (not during initial switch)
        if (!props.isThinking && isOpen.value) {
          _toggle();
        }
      }, 1500);
    }
  },
);

onMounted(() => {
  if (props.isThinking && scrollArea.value) {
    scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
  }
});

onUnmounted(() => {
  if (collapseTimer) clearTimeout(collapseTimer);
});

defineExpose({ isOpen });
</script>

<style scoped>
.think-block {
  margin: 12px 0 20px;
}

.think-header {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 0;
  font-family: inherit;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  width: 100%;
}

.think-header:hover {
  color: var(--text);
  background: var(--bg-hover);
  border-radius: 6px;
  padding-left: 8px;
  margin-left: -8px;
}

.think-header__icon {
  color: var(--accent);
  display: flex;
  align-items: center;
  filter: drop-shadow(0 0 4px var(--accent-muted));
}

.think-header__chevron {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0.4;
  margin-left: 2px;
}

.think-accordion {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.think-accordion--closed {
  grid-template-rows: 0fr;
}

.think-accordion__inner {
  overflow: hidden;
}

.think-scroll-area {
  max-height: 250px;
  overflow-y: auto;
  margin-top: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-muted) transparent;
}

.think-block--streaming .think-scroll-area {
  scroll-behavior: auto;
}

.think-scroll-area::-webkit-scrollbar {
  width: 4px;
}

.think-scroll-area::-webkit-scrollbar-thumb {
  background: var(--border-muted);
  border-radius: 4px;
}

.think-timeline {
  position: relative;
  margin-left: 9px;
  padding-left: 20px;
  border-left: 1px solid var(--border-muted);
}

.think-step {
  position: relative;
  margin-bottom: 8px; /* Reduced from 14px */
}

.think-step:last-child {
  margin-bottom: 2px;
}

.think-step__marker {
  position: absolute;
  left: -20.5px;
  top: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1px;
}

.think-step__dot {
  width: 4px;
  height: 4px;
  background: var(--text-dim);
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.5;
}

.think-step__content {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  font-weight: 400;
  display: inline-block;
  width: 100%;
  contain: content;
}

/* Compact markdown typography for reasoning content */
.think-step__content :deep(p) {
  margin: 0;
}
.think-step__content :deep(p + p) {
  margin-top: 4px;
}

.think-step__content :deep(ul),
.think-step__content :deep(ol) {
  margin: 3px 0;
  padding-left: 1.3em;
}
.think-step__content :deep(ul) {
  list-style-type: disc;
}
.think-step__content :deep(ol) {
  list-style-type: decimal;
}
.think-step__content :deep(li) {
  margin: 1px 0;
}
.think-step__content :deep(li::marker) {
  color: var(--text-dim);
  opacity: 0.6;
}

.think-step__content :deep(strong) {
  font-weight: 600;
  color: var(--text);
}
.think-step__content :deep(em) {
  font-style: italic;
}

.think-step__content :deep(:not(pre) > code) {
  font-family: var(--mono);
  font-size: 0.82em;
  background: rgba(0, 0, 0, 0.25);
  color: var(--text-muted);
  padding: 0.1em 0.35em;
  border-radius: 3px;
  border: 1px solid var(--border);
  white-space: nowrap;
}

.think-step__content :deep(a) {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-color: var(--accent-border);
}

.think-step__content :deep(blockquote) {
  border-left: 2px solid var(--border-strong);
  margin: 3px 0;
  padding: 0 0 0 0.7em;
  color: var(--text-dim);
  font-style: italic;
}
.think-step__content :deep(blockquote p) {
  margin: 0;
}

.think-step__active {
  display: inline;
  vertical-align: baseline;
}

.think-timeline-tool {
  margin-bottom: 14px;
}

/* Animations */
@keyframes brain-pulse {
  0% {
    transform: scale(1);
    opacity: 1;
    filter: drop-shadow(0 0 4px var(--accent-muted));
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
    filter: drop-shadow(0 0 8px var(--accent));
  }
  100% {
    transform: scale(1);
    opacity: 1;
    filter: drop-shadow(0 0 4px var(--accent-muted));
  }
}

.think-block--streaming .brain-icon {
  animation: brain-pulse 2.5s infinite ease-in-out;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.think-step__active {
  display: inline;
  white-space: pre-wrap;
}

.think-fade-enter-from,
.think-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.think-part-fade-enter-active {
  transition: all 0.5s ease;
}
.think-part-fade-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.think-step-list-enter-active,
.think-step-list-leave-active {
  transition: all 0.4s ease;
}
.think-step-list-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.think-step--pulse .think-step__dot {
  animation: dot-pulse 2s infinite ease-in-out;
  background: var(--accent);
  opacity: 0.8;
}

.think-step__analyzing {
  font-style: italic;
  opacity: 0.7;
}

@keyframes dot-pulse {
  0% {
    transform: scale(1);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.5);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 0.4;
  }
}

.think-cursor {
  display: inline-block;
  width: 1.5px;
  height: 14px;
  background: var(--accent);
  margin-left: 2px;
  vertical-align: text-bottom; /* Better alignment with text */
  animation: blink 0.8s infinite;
}
</style>
