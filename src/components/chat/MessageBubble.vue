<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRafFn } from '@vueuse/core'
import { renderMarkdown } from '../../lib/markdown'
import type { Message } from '../../types/chat'
import { useUIStore } from '../../stores/ui'
import ThinkBlock from './ThinkBlock.vue'
import CodeBlock from './CodeBlock.vue'

const props = defineProps<{
  message: Message
  isStreaming?: boolean
  thinkingContent?: string // Streaming thinking
  isThinking?: boolean
  tokensPerSec?: number | null
}>()

const uiStore = useUIStore()
const isCompact = computed(() => uiStore.isCompactMode)
const isUser = computed(() => props.message.role === 'user')

interface MessagePart {
  type: 'markdown' | 'code'
  content: string
  language?: string
  rendered?: string
}

// Throttled rendered parts
const throttledParts = ref<MessagePart[]>([])
let frameCount = 0
const RENDER_EVERY_N_FRAMES = 4 // Approx 15fps during streaming for maximum smoothness/CPU balance

// Extract thinking content from archived messages
const extractedThinking = computed(() => {
  if (isUser.value) return null
  const match = props.message.content.match(/<think>([\s\S]*?)<\/think>/)
  return match ? match[1].trim() : null
})

// Clean content without <think> tags for rendering
const cleanContent = computed(() => {
  if (isUser.value) return props.message.content
  // Remove <think> blocks and trim carefully to avoid layout shifts
  const cleaned = props.message.content.replace(/<think>[\s\S]*?<\/think>/g, '')
  return cleaned.trim()
})

const renderParts = () => {
  const content = cleanContent.value
  if (!content && !isUser.value) {
    throttledParts.value = []
    return
  }

  // If user message, just one markdown part
  if (isUser.value) {
    throttledParts.value = [{
      type: 'markdown',
      content: content,
      rendered: content
    }]
    return
  }

  const parts: MessagePart[] = []
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)(?:```|$)/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index)
      if (text) {
        parts.push({
          type: 'markdown',
          content: text,
          rendered: renderMarkdown(text)
        })
      }
    }

    parts.push({
      type: 'code',
      language: match[1] || 'text',
      content: match[2] || ''
    })

    lastIndex = codeBlockRegex.lastIndex
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex)
    if (text) {
      parts.push({
        type: 'markdown',
        content: text,
        rendered: renderMarkdown(text)
      })
    }
  }

  throttledParts.value = parts
}

// Architectural Throttling via useRafFn
const { pause, resume, isActive } = useRafFn(() => {
  frameCount++
  if (frameCount % RENDER_EVERY_N_FRAMES === 0 || !props.isStreaming) {
    renderParts()
    // If not streaming, we only need one final render
    if (!props.isStreaming) {
      pause()
    }
  }
}, { immediate: false })

// Re-render immediately when streaming status changes
watch(() => props.isStreaming, (streaming, oldStreaming) => {
  if (streaming) {
    frameCount = 0
    resume()
  } else if (oldStreaming === true) {
    renderParts()
    pause()
  }
}, { immediate: true })

// Watch for content changes
watch(cleanContent, () => {
  if (props.isStreaming) {
    if (!isActive.value) resume()
  } else {
    renderParts()
  }
}, { immediate: true })

onUnmounted(() => pause())
</script>

<template>
  <div
    class="group flex w-full transition-all duration-300 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10"
    :class="[
      isUser ? 'justify-end' : 'justify-start',
      isCompact ? 'py-4 px-4' : 'py-8 px-6'
    ]"
  >
    <!-- Avatar (Assistant) -->
    <div
      v-if="!isUser"
      class="flex-shrink-0 flex items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-400/10 ring-1 ring-orange-200 dark:ring-orange-800/30 shadow-sm"
      :class="[isCompact ? 'w-8 h-8 mr-3' : 'w-10 h-10 mr-4']"
    >
      <span class="text-orange-600 dark:text-orange-400 font-bold" :class="[isCompact ? 'text-[11px]' : 'text-[13px]']">O</span>
    </div>

    <!-- Message Content -->
    <div
      class="flex flex-col max-w-[85%] sm:max-w-[75%] space-y-2.5"
      :class="[isUser ? 'items-end' : 'items-start']"
    >
      <!-- User Message Bubble -->
      <div
        v-if="isUser"
        class="bg-blue-600 text-white font-sans shadow-lg shadow-blue-500/10 leading-relaxed whitespace-pre-wrap selection:bg-blue-400/50"
        :class="[isCompact ? 'px-4 py-2 text-[13px] rounded-2xl rounded-tr-sm' : 'px-5 py-3 text-[15px] rounded-2xl rounded-tr-sm']"
      >
        {{ message.content }}
      </div>

      <!-- Assistant Message Area -->
      <div
        v-else
        class="text-neutral-800 dark:text-neutral-100 leading-relaxed font-sans w-full"
        :class="[isCompact ? 'text-[13px]' : 'text-[15px]']"
      >
        <!-- Reasoning / Thinking Block -->
        <ThinkBlock
          v-if="isThinking || extractedThinking || (thinkingContent && thinkingContent.length > 0)"
          :content="thinkingContent || extractedThinking || ''"
          :is-thinking="!!isThinking"
        />

        <!-- Rendered Content Parts -->
        <div class="prose dark:prose-invert prose-p:my-4 prose-pre:my-0 prose-pre:p-0 prose-pre:bg-transparent max-w-none animate-in fade-in duration-700">
          <template v-for="(part, index) in throttledParts" :key="index">
            <div v-if="part.type === 'markdown'" class="rendered-markdown" v-html="part.rendered"></div>
            <CodeBlock v-else-if="part.type === 'code'" :code="part.content" :language="part.language || ''" />
          </template>
        </div>

        <!-- Blinking cursor for streaming -->
        <div
          v-if="isStreaming && !isThinking"
          class="inline-flex items-center mt-2"
        >
          <span class="w-1.5 h-5 bg-[#FF6B35] animate-pulse rounded-full shadow-[0_0_8px_rgba(255,107,53,0.5)]"></span>
        </div>
      </div>

      <!-- Stats / Metadata -->
      <div v-if="tokensPerSec && !isStreaming" class="text-[9px] font-mono font-bold tracking-[0.2em] text-neutral-400 dark:text-zinc-600 mt-3 uppercase flex items-center space-x-3 transition-opacity duration-500">
        <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800/50">
          <span class="w-1 h-1 rounded-full bg-green-500/80 mr-2 shadow-[0_0_4px_rgba(34,197,94,0.4)]"></span>
          {{ tokensPerSec.toFixed(1) }} TOK/S
        </span>
      </div>
    </div>

    <!-- User Avatar -->
    <div
      v-if="isUser"
      class="flex-shrink-0 flex items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800/30 shadow-sm"
      :class="[isCompact ? 'w-8 h-8 ml-3' : 'w-10 h-10 mr-4']"
    >
      <span class="text-blue-600 dark:text-blue-400 font-bold" :class="[isCompact ? 'text-[11px]' : 'text-[13px]']">U</span>
    </div>
  </div>
</template>

<style scoped>
.rendered-markdown :deep(pre) {
  display: none !important;
}

.rendered-markdown :deep(code:not(pre code)) {
  background-color: var(--code-bg, rgba(0,0,0,0.05));
  padding: 0.15rem 0.4rem;
  border-radius: 0.375rem;
  font-family: var(--mono);
  font-size: 0.85em;
  font-weight: 600;
  border: 1px solid var(--border, rgba(0,0,0,0.1));
}

.rendered-markdown :deep(p:last-child) {
  margin-bottom: 0;
}
</style>

