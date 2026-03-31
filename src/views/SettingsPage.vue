<template>
  <div class="h-full flex flex-col p-8 overflow-y-auto bg-white dark:bg-[#0F0F0F] selection:bg-neutral-900 selection:text-white dark:selection:bg-white dark:selection:text-black">
    <div class="max-w-4xl mx-auto w-full">
      <header class="mb-12" :class="[isCompact ? 'mb-6' : 'mb-12']">
        <h1 class="text-5xl font-extrabold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-500" :class="[isCompact ? 'text-3xl' : 'text-5xl']">
          Settings
        </h1>
        <p class="text-neutral-500 dark:text-neutral-400 text-lg font-medium" :class="[isCompact ? 'text-sm' : 'text-lg']">Personalize your Ollama experience.</p>
      </header>

      <div class="space-y-20">
        <!-- General Section -->
        <section>
          <div class="flex items-center gap-3 mb-8">
            <div class="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <h2 class="text-2xl font-black tracking-tight">General</h2>
          </div>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between p-7 rounded-[2rem] bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-100 dark:border-neutral-800/50 backdrop-blur-sm group hover:border-neutral-200 dark:hover:border-neutral-700 transition-all">
              <div>
                <p class="font-bold text-xl mb-1 tracking-tight">Launch at login</p>
                <p class="text-sm text-neutral-500 font-bold opacity-80">Automatically start Ollama when you sign in.</p>
              </div>
              <button class="w-14 h-8 bg-neutral-200 dark:bg-neutral-800 rounded-full relative transition-all group/toggle">
                <span class="absolute left-1 top-1 w-6 h-6 bg-white dark:bg-neutral-400 rounded-full shadow-sm transition-all translate-x-6 !bg-neutral-900 dark:!bg-white"></span>
              </button>
            </div>
            
            <div class="flex flex-col md:flex-row md:items-center justify-between p-7 rounded-[2rem] bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-100 dark:border-neutral-800/50 backdrop-blur-sm gap-4 group hover:border-neutral-200 dark:hover:border-neutral-700 transition-all">
              <div>
                <p class="font-bold text-xl mb-1 tracking-tight">Ollama Server URL</p>
                <p class="text-sm text-neutral-500 font-bold opacity-80">Host address for the local Ollama API.</p>
              </div>
              <div class="relative w-full md:w-80">
                <input 
                  type="text" 
                  value="http://localhost:11434" 
                  class="bg-white dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 px-6 py-3 rounded-2xl text-sm font-bold font-mono outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all w-full" 
                />
              </div>
            </div>
          </div>
        </section>

        <!-- Models Section -->
        <section>
          <div class="flex items-center gap-3 mb-8">
            <div class="p-2.5 bg-orange-50 dark:bg-orange-950/30 rounded-2xl text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
            </div>
            <h2 class="text-2xl font-black tracking-tight">Models</h2>
          </div>
          
          <div class="space-y-4">
            <div class="flex flex-col md:flex-row md:items-center justify-between p-7 rounded-[2rem] bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-100 dark:border-neutral-800/50 backdrop-blur-sm gap-4 group hover:border-neutral-200 dark:hover:border-neutral-700 transition-all">
              <div>
                <p class="font-bold text-xl mb-1 tracking-tight">Model Storage Path</p>
                <p class="text-sm text-neutral-500 font-bold opacity-80">Where model blobs and metadata are stored on disk.</p>
              </div>
              <div class="flex items-center gap-3 w-full md:w-auto">
                <code class="px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-mono font-bold text-neutral-600 dark:text-neutral-400 truncate max-w-[200px]">~/.ollama/models</code>
                <button class="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all">Change</button>
              </div>
            </div>
          </div>
        </section>

        <!-- GPU & Performance -->
        <section>
          <div class="flex items-center gap-3 mb-8">
            <div class="p-2.5 bg-green-50 dark:bg-green-950/30 rounded-2xl text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v12"/><path d="M18 9v12"/><path d="M6 10h12"/><path d="M6 14h12"/></svg>
            </div>
            <h2 class="text-2xl font-black tracking-tight">GPU & Performance</h2>
          </div>
          
          <div class="space-y-4">
            <div class="p-7 rounded-[2rem] bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-100 dark:border-neutral-800/50 backdrop-blur-sm group hover:border-neutral-200 dark:hover:border-neutral-700 transition-all">
              <div class="flex items-center justify-between mb-6">
                <div>
                  <p class="font-bold text-xl mb-1 tracking-tight">VRAM Optimization</p>
                  <p class="text-sm text-neutral-500 font-bold opacity-80">Control how much memory is allocated for model layers.</p>
                </div>
                <span class="text-blue-500 font-black text-sm uppercase tracking-widest">Automatic</span>
              </div>
              <div class="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 w-[65%] rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)]"></div>
              </div>
              <div class="flex justify-between mt-3">
                <span class="text-[10px] font-black text-neutral-400 uppercase tracking-tighter">0 GB</span>
                <span class="text-[10px] font-black text-neutral-400 uppercase tracking-tighter text-right">8 GB (RTX 3070 Appx)</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Appearance Section -->
        <section>
          <div class="flex items-center gap-3 mb-8">
            <div class="p-2.5 bg-purple-50 dark:bg-purple-950/30 rounded-2xl text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 1.912 5.886h6.19l-5.007 3.638L17.007 18.41 12 14.772l-5.007 3.638 1.912-5.886-5.007-3.638h6.19z"/></svg>
            </div>
            <h2 class="text-2xl font-black tracking-tight">Appearance</h2>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <button class="flex flex-col items-center gap-5 p-6 rounded-[2rem] border-2 border-neutral-900 dark:border-white bg-neutral-50/50 dark:bg-neutral-900/50 transition-all shadow-xl shadow-neutral-200/50 dark:shadow-none ring-4 ring-neutral-900/5 dark:ring-white/5">
              <div class="w-full aspect-[4/3] rounded-2xl bg-gradient-to-br from-white to-neutral-200 dark:from-neutral-800 dark:to-neutral-950 border border-neutral-100 dark:border-neutral-800 flex items-center justify-center relative overflow-hidden group">
                <div class="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div class="w-1/2 h-2.5 bg-neutral-900 dark:bg-white rounded-full opacity-20"></div>
              </div>
              <span class="text-sm font-black tracking-wide uppercase">System Default</span>
            </button>
            <button class="flex flex-col items-center gap-5 p-6 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all group">
              <div class="w-full aspect-[4/3] bg-white rounded-2xl border border-neutral-100 flex items-center justify-center group-hover:scale-[1.02] transition-transform">
                <div class="w-1/2 h-2.5 bg-neutral-900 rounded-full opacity-10"></div>
              </div>
              <span class="text-sm font-bold opacity-60 tracking-wide uppercase">Light Mode</span>
            </button>
            <button class="flex flex-col items-center gap-5 p-6 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 transition-all group">
              <div class="w-full aspect-[4/3] bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-center group-hover:scale-[1.02] transition-transform">
                <div class="w-1/2 h-2.5 bg-white rounded-full opacity-10"></div>
              </div>
              <span class="text-sm font-bold opacity-60 tracking-wide uppercase">Dark Mode</span>
            </button>
          </div>
        </section>

        <!-- Footer / Status Section -->
        <section class="pb-12 border-t border-neutral-100 dark:border-neutral-900 pt-16 text-center md:text-left">
          <div class="flex flex-col md:flex-row items-center justify-between gap-8">
            <div class="space-y-1">
              <p class="text-xs text-neutral-400 font-black uppercase tracking-[0.2em]">Application Status</p>
              <p class="text-neutral-600 dark:text-neutral-400 font-bold text-lg">Version 0.1.00 <span class="text-blue-500 ml-2 text-sm font-black">STABLE</span></p>
            </div>
            <div class="flex items-center gap-4">
              <button class="px-8 py-3.5 rounded-2xl bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-white font-black text-sm hover:scale-105 transition-all active:scale-95 border border-neutral-200 dark:border-neutral-800 shadow-sm">
                Check for Updates
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUIStore } from '../stores/ui'

const uiStore = useUIStore()
const isCompact = computed(() => uiStore.isCompactMode)

// Logic for settings persistence will be added in Phase C
</script>
