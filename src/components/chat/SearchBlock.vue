<template>
  <div class="search-block" :class="{ 'search-block--complete': !!result }">
    <!-- Header: Compact & Integrated -->
    <div 
      class="flex items-center gap-3 py-1.5 px-3 rounded-full bg-[var(--bg-active)]/40 border border-[var(--border-subtle)] w-fit mb-3 transition-all duration-300 hover:bg-[var(--bg-active)]/60 cursor-pointer group"
      @click="toggleCollapse"
    >
      <div v-if="!result" class="flex items-center justify-center">
        <svg class="w-3.5 h-3.5 animate-spin text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <circle cx="12" cy="12" r="10" stroke-dasharray="12 40" stroke-linecap="round" />
        </svg>
      </div>
      <div v-else class="flex items-center justify-center">
        <svg class="w-3.5 h-3.5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-5"/>
        </svg>
      </div>
      <div class="flex items-center gap-1.5 overflow-hidden">
        <span class="text-[12px] font-medium text-[var(--text-muted)] whitespace-nowrap">
          {{ !result ? 'Searching for' : `Sourced ${sourcesCount} references for` }}
        </span>
        <span class="text-[12px] font-bold text-[var(--text)] truncate max-w-[140px] md:max-w-[300px]">{{ query }}</span>
      </div>
      <svg 
        v-if="result"
        class="w-3 h-3 text-[var(--text-dim)] transition-transform duration-300"
        :class="{ 'rotate-180': isOpen }"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
      >
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>

    <!-- Sources Grid -->
    <div class="search-accordion" :class="{ 'search-accordion--closed': !isOpen }">
      <div class="search-accordion__inner">
        <div v-if="result" class="pb-2">
           <div v-if="parsedResults.length > 0" class="flex flex-wrap gap-2">
              <div 
                v-for="(item, index) in parsedResults" 
                :key="index"
                @click="openUrl(item.url)"
                class="group relative flex items-center gap-2.5 px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent)]/40 rounded-lg cursor-pointer transition-all duration-200 hover:bg-[var(--bg-hover)] hover:-translate-y-0.5"
                :title="item.title + '\\n\\n' + item.content"
              >
                <!-- Favicon Wrapper -->
                <div class="w-5 h-5 rounded bg-[var(--bg-base)] flex items-center justify-center border border-[var(--border-subtle)] flex-shrink-0">
                  <img :src="getFaviconUrl(item.url)" class="w-3 h-3 grayscale group-hover:grayscale-0 transition-all opacity-70 group-hover:opacity-100" @error="handleIconError" />
                </div>

                <div class="flex flex-col min-w-0 max-w-[120px] md:max-w-[180px]">
                   <span class="text-[11.5px] font-bold text-[var(--text)] truncate leading-tight group-hover:text-[var(--accent)] transition-colors">{{ extractSiteName(item.url, item.title) }}</span>
                   <span class="text-[9px] font-mono text-[var(--text-dim)] truncate opacity-60">{{ cleanUrl(item.url) }}</span>
                </div>

                <!-- Index Circle -->
                <div class="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--bg-active)] border border-[var(--border-subtle)] text-[8.5px] font-bold text-[var(--text-muted)] flex-shrink-0">
                  {{ index + 1 }}
                </div>
              </div>
           </div>
           
           <!-- Fallback raw result -->
           <div v-else class="text-[12px] text-[var(--text-muted)] font-mono bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-subtle)] whitespace-pre-wrap">
             {{ result }}
           </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { openUrl as tauriOpenUrl } from '../../lib/urlOpener'
import { useCollapsibleState } from '../../composables/useCollapsibleState'

const props = defineProps<{
  query: string
  result?: string
  messageKey?: string
}>()

const { isOpen, toggle: _toggle } = useCollapsibleState({
  messageKey: props.messageKey,
  suffix: 'search',
  initialOpen: false,
})

const toggleCollapse = (event: MouseEvent) => {
  if (props.result) {
    event.stopPropagation()
    _toggle()
  }
}

const openUrl = async (url: string) => {
  await tauriOpenUrl(url)
}

const extractSiteName = (url: string, title: string) => {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    const mainPart = hostname.split('.')[0]
    // If it's a known service, use a pretty name
    if (mainPart === 'github') return 'GitHub'
    if (mainPart === 'wikipedia') return 'Wikipedia'
    if (mainPart === 'reddit') return 'Reddit'
    if (mainPart === 'medium') return 'Medium'
    if (mainPart === 'arxiv') return 'arXiv'
    
    // Otherwise try to capitalize or use the first word of the title if it's short
    return mainPart.charAt(0).toUpperCase() + mainPart.slice(1)
  } catch {
    return title.split(' ')[0]
  }
}

const cleanUrl = (url: string) => {
  try {
    const d = new URL(url).hostname
    return d.replace('www.', '')
  } catch {
    return url
  }
}

const getFaviconUrl = (url: string) => {
  try {
    const domain = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

const handleIconError = (e: Event) => {
  (e.target as HTMLImageElement).style.display = 'none'
}

interface SearchResult {
  title: string
  url: string
  content: string
}

const sourcesCount = computed(() => parsedResults.value.length)

const parsedResults = computed<SearchResult[]>(() => {
  if (!props.result) return []
  try {
    const parsed = JSON.parse(props.result)
    const rawResults = (parsed.results && Array.isArray(parsed.results)) 
      ? parsed.results 
      : (Array.isArray(parsed) ? parsed : [])
    
    return rawResults.map((r: SearchResult) => ({
      title: r.title || 'Untitled Result',
      url: r.url || '#',
      content: r.content || 'No description available.'
    })).filter((r: SearchResult) => r.url !== '#')
  } catch {
    return []
  }
})
</script>

<style scoped>
.search-block {
  margin: 12px 0 20px -4px;
  width: 100%;
}

/* Transition for expanding/collapsing */
.search-accordion {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-accordion--closed {
  grid-template-rows: 0fr;
}

.search-accordion__inner {
  overflow: hidden;
}

.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
