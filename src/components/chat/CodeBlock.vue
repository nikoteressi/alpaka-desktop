<template>
  <div class="group relative my-8 rounded-xl overflow-hidden border border-zinc-200/50 dark:border-zinc-800/80 bg-[#0d1117] shadow-2xl shadow-black/40 transition-all duration-300 hover:shadow-[#FF6B35]/5">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-2.5 bg-[#161b22] border-b border-zinc-800/50 text-[11px] font-mono">
      <div class="flex items-center space-x-4">
        <div class="flex space-x-1.5 opacity-50">
          <div class="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
          <div class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
          <div class="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
        </div>
        <div class="h-4 w-[1px] bg-zinc-800 mx-1"></div>
        <span class="text-zinc-400 font-bold uppercase tracking-[0.2em] text-[10px]">
          {{ language || 'plaintext' }}
        </span>
      </div>
      
      <button
        @click="copyCode"
        class="flex items-center space-x-2 text-zinc-400 hover:text-[#FF6B35] transition-all duration-300 font-bold uppercase tracking-widest text-[9px] group/copy"
      >
        <template v-if="copied">
          <svg class="w-3.5 h-3.5 text-green-400 animate-in zoom-in duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
          <span class="text-green-400">Copied</span>
        </template>
        <template v-else>
          <svg class="w-3.5 h-3.5 transition-transform group-hover/copy:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke-width="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke-width="2" />
          </svg>
          <span>Copy</span>
        </template>
      </button>
    </div>

    <!-- Code Content -->
    <div class="relative group/content">
      <div class="overflow-x-auto p-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <div v-if="highlightedHtml" v-html="highlightedHtml" class="shiki-container animate-in fade-in duration-500"></div>
        <pre v-else class="text-[13px] leading-relaxed font-mono text-zinc-300"><code>{{ code }}</code></pre>
      </div>
      
      <!-- Subtle language watermark on the bottom right -->
      <div class="absolute bottom-3 right-6 opacity-[0.03] pointer-events-none select-none text-[48px] font-black font-mono text-white italic">
        {{ language }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { highlight } from '../../lib/markdown'

const props = defineProps<{
  code: string
  language: string
}>()

const highlightedHtml = ref('')
const copied = ref(false)

// Use a simple debounce for streaming performance
let highlightTimeout: ReturnType<typeof setTimeout> | null = null

async function updateHighlight() {
  if (highlightTimeout) clearTimeout(highlightTimeout)
  
  highlightTimeout = setTimeout(async () => {
    if (props.code) {
      try {
        highlightedHtml.value = await highlight(props.code, props.language)
      } catch (err) {
        console.error('Failed to highlight code:', err)
        highlightedHtml.value = ''
      }
    } else {
      highlightedHtml.value = ''
    }
  }, 50) // 50ms debounce for streaming
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}

// Re-highlight if code or language changes
watch([() => props.code, () => props.language], updateHighlight, { immediate: false })

onMounted(() => {
  updateHighlight()
})
</script>

<style>
.shiki-container pre {
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  font-size: 13px !important;
  line-height: 1.8 !important;
  font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace) !important;
}

.shiki-container code {
  color: inherit !important;
  background: transparent !important;
  padding: 0 !important;
}

/* Scrollbar styling */
.scrollbar-thin::-webkit-scrollbar {
  height: 10px;
  width: 10px;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 10px;
  border: 2px solid #0d1117;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #484f58;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
</style>

