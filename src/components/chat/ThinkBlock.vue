<template>
  <div class="mb-6">
    <div
      class="overflow-hidden border-2 rounded-xl bg-[#09090b] transition-all duration-500 ease-in-out group/think"
      :class="[
        isThinking 
          ? 'border-[#FF6B35] shadow-[0_0_25px_rgba(255,107,53,0.2)]' 
          : 'border-zinc-800/50'
      ]"
    >
      <!-- Console Header -->
      <button
        @click="isExpanded = !isExpanded"
        class="w-full flex items-center justify-between px-4 py-3 text-xs font-mono border-b border-zinc-800/40 hover:bg-white/[0.02] transition-colors"
      >
        <div class="flex items-center space-x-3">
          <div class="flex space-x-1.5 px-0.5 opacity-60">
            <div class="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
            <div class="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
          </div>
          <div class="flex items-center space-x-2">
            <span 
              class="font-bold uppercase tracking-[0.1em] text-[10px]"
              :class="isThinking ? 'text-[#FF6B35]' : 'text-zinc-500'"
            >
              {{ isThinking ? 'Executing Thought Process...' : 'Thought Process Logs' }}
            </span>
            <span v-if="isThinking" class="flex h-1.5 w-1.5 rounded-full bg-[#FF6B35] animate-pulse"></span>
          </div>
        </div>
        
        <div class="flex items-center space-x-3 text-zinc-500">
          <span v-if="!isThinking && content" class="text-[9px] uppercase tracking-widest opacity-40">
            {{ formatBytes(content.length) }}
          </span>
          <svg
            class="w-4 h-4 transition-transform duration-300 ease-in-out opacity-40"
            :class="{ 'rotate-180': isExpanded }"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      <!-- Console Body -->
      <div
        v-show="isExpanded"
        class="relative px-6 py-5 min-h-[4rem] text-[13px] leading-relaxed font-mono text-zinc-300 whitespace-pre-wrap overflow-x-auto selection:bg-[#FF6B35]/30 scrollbar-none"
      >
        <!-- Dynamic Pulsing Border Effect for Thinking State -->
        <div v-if="isThinking" class="absolute inset-0 pointer-events-none border border-[#FF6B35]/20 animate-think-pulse-soft"></div>
        
        <div class="relative z-10">
          <span class="opacity-50 mr-2 text-[#FF6B35] font-bold">$</span>
          {{ content }}
          <span v-if="isThinking" class="inline-block w-2 h-4 bg-[#FF6B35] animate-terminal-cursor ml-1 align-middle shadow-[0_0_10px_#FF6B35]"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  content: string
  isThinking: boolean
}>()

const isExpanded = ref(true)

// Utility to format bytes
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

// Auto-collapse when thinking finishes
watch(() => props.isThinking, (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    // Keep it expanded for a moment before auto-collapsing
    setTimeout(() => {
      isExpanded.value = false
    }, 2000)
  }
})
</script>

<style scoped>
@keyframes think-pulse-soft {
  0%, 100% { opacity: 0.2; }
  50% { opacity: 0.5; }
}

.animate-think-pulse-soft {
  animation: think-pulse-soft 2s ease-in-out infinite;
}

@keyframes terminal-cursor {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.1; transform: scale(0.95); }
}

.animate-terminal-cursor {
  animation: terminal-cursor 0.8s step-end infinite;
}

.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>



