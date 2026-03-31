<template>
  <div class="h-full flex flex-col p-8 overflow-y-auto bg-white dark:bg-[#0F0F0F] selection:bg-neutral-900 selection:text-white dark:selection:bg-white dark:selection:text-black">
    <div class="max-w-4xl mx-auto w-full">
      <header class="mb-12 text-center md:text-left" :class="[isCompact ? 'mb-6' : 'mb-12']">
        <h1 class="text-5xl font-extrabold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-500" :class="[isCompact ? 'text-3xl' : 'text-5xl']">
          Models
        </h1>
        <p class="text-neutral-500 dark:text-neutral-400 text-lg font-medium" :class="[isCompact ? 'text-sm' : 'text-lg']">Manage your local library and explore new capabilities.</p>
      </header>

      <section class="mb-16">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10" :class="[isCompact ? 'mb-6' : 'mb-10']">
          <div class="flex items-center gap-4">
            <h2 class="text-3xl font-black tracking-tight">Local Library</h2>
            <div class="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-500 uppercase tracking-widest">
              3 Models
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="relative group/search">
              <input 
                type="text" 
                placeholder="Filter library..." 
                class="h-11 pl-10 pr-4 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 outline-none transition-all text-sm font-medium w-64"
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within/search:text-blue-500 transition-colors"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <button class="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-neutral-200 dark:shadow-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24"/><path d="M21 3v9h-9"/></svg>
              Update All
            </button>
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Model Card 1 -->
          <div class="group p-6 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800/50 bg-neutral-50/30 dark:bg-neutral-900/20 backdrop-blur-xl relative overflow-hidden hover:border-blue-500/30 dark:hover:border-blue-400/30 transition-all duration-500">
            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 transition-all duration-700"></div>
            
            <div class="flex items-start justify-between relative z-10 mb-6">
              <div class="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                <span class="text-xl font-black text-neutral-800 dark:text-neutral-200">L3</span>
              </div>
              <div class="flex gap-2">
                <button class="p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="p-2.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>

            <div class="relative z-10">
              <div class="flex items-center gap-2 mb-1">
                <h3 class="font-bold text-xl tracking-tight">llama3:8b</h3>
                <span class="px-1.5 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-tighter">Latest</span>
              </div>
              <p class="text-xs text-neutral-500 font-bold uppercase tracking-widest opacity-60 mb-4">4.7 GB • Q4_K_M • Modified 2d ago</p>
              
              <div class="flex flex-wrap gap-2">
                <span class="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400">Meta</span>
                <span class="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400">Tool Use</span>
                <span class="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400">8K Context</span>
              </div>
            </div>
          </div>

          <!-- Model Card 2 -->
          <div class="group p-6 rounded-[2.5rem] border border-neutral-100 dark:border-neutral-800/50 bg-neutral-50/30 dark:bg-neutral-900/20 backdrop-blur-xl relative overflow-hidden hover:border-orange-500/30 dark:hover:border-orange-400/30 transition-all duration-500">
            <div class="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-yellow-500/0 group-hover:from-orange-500/5 group-hover:to-yellow-500/5 transition-all duration-700"></div>
            
            <div class="flex items-start justify-between relative z-10 mb-6">
              <div class="w-14 h-14 rounded-2xl bg-white dark:bg-neutral-800 flex items-center justify-center shadow-sm border border-neutral-100 dark:border-neutral-700 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                <span class="text-xl font-black text-neutral-800 dark:text-neutral-200">M1</span>
              </div>
              <div class="flex gap-2">
                <button class="p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="p-2.5 hover:bg-red-50 dark:hover:bg-red-950/30 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </div>
            </div>

            <div class="relative z-10">
              <h3 class="font-bold text-xl tracking-tight mb-1">mistral:latest</h3>
              <p class="text-xs text-neutral-500 font-bold uppercase tracking-widest opacity-60 mb-4">4.1 GB • Q4_0 • Modified 1w ago</p>
              
              <div class="flex flex-wrap gap-2">
                <span class="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400">Mistral AI</span>
                <span class="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400">General</span>
                <span class="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-400">32K Context</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="mt-20 mb-12">
        <div class="bg-neutral-900 dark:bg-neutral-50 p-10 md:p-14 rounded-[3.5rem] relative overflow-hidden group border border-neutral-800 dark:border-neutral-200">
          <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div class="max-w-md">
              <h2 class="text-4xl font-black text-white dark:text-black mb-4 tracking-tighter">Explore Library</h2>
              <p class="text-neutral-400 dark:text-neutral-500 mb-0 font-medium text-lg leading-relaxed">Search thousands of open-source models optimized for your machine.</p>
            </div>
            
            <div class="w-full max-w-md relative group/input">
              <input 
                type="text" 
                placeholder="Search ollama.com/library..." 
                class="w-full h-16 pl-14 pr-4 rounded-2xl bg-white/10 dark:bg-black/5 text-white dark:text-black border border-white/10 dark:border-black/10 focus:ring-4 focus:ring-blue-500/30 dark:focus:ring-blue-500/10 outline-none transition-all placeholder:text-neutral-500 font-bold"
              />
              <div class="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within/input:text-blue-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </div>
              <div class="absolute right-4 top-1/2 -translate-y-1/2">
                <kbd class="hidden md:inline-flex h-8 select-none items-center gap-1 rounded border border-white/20 dark:border-black/20 bg-white/5 dark:bg-black/5 px-2 font-mono text-[10px] font-black text-neutral-400 opacity-100 uppercase">
                  <span class="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>
          <!-- Animated Background Elements -->
          <div class="absolute top-0 right-0 w-80 h-80 bg-blue-500/20 blur-[100px] -mr-20 -mt-20 group-hover:scale-125 transition-transform duration-1000"></div>
          <div class="absolute bottom-0 left-0 w-60 h-60 bg-purple-500/10 blur-[80px] -ml-20 -mb-20 group-hover:scale-110 transition-transform duration-1000"></div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore } from '../stores/ui'

const uiStore = useUIStore()
const isCompact = computed(() => uiStore.isCompactMode)

// Logic for model management will be integrated in Phase C
</script>
