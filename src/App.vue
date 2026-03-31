<template>
  <div class="h-screen w-screen overflow-hidden bg-white dark:bg-[#0F0F0F] text-neutral-900 dark:text-neutral-100 font-sans flex">
    <!-- Sidebar Navigation -->
    <aside class="w-16 md:w-64 border-r border-neutral-100 dark:border-neutral-900 flex flex-col h-full bg-neutral-50/30 dark:bg-black/20 backdrop-blur-md">
      <div class="p-4 md:p-6 mb-8 mt-4">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center">
            <svg viewBox="0 0 24 24" class="w-5 h-5 fill-white dark:fill-black" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <span class="font-bold text-xl tracking-tight hidden md:inline-block">Ollama</span>
        </div>
      </div>

      <nav class="flex-1 px-2 md:px-4 space-y-2">
        <router-link 
          v-for="item in navItems" 
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-3 py-3 rounded-2xl transition-all group relative"
          :class="[
            $route.path === item.path 
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-black shadow-lg shadow-neutral-200 dark:shadow-none' 
              : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          ]"
        >
          <div :class="[$route.path === item.path ? 'scale-110' : 'group-hover:scale-110']" class="transition-transform duration-300">
            <component :is="item.icon" class="w-6 h-6" />
          </div>
          <span class="font-semibold hidden md:inline-block mt-0.5">{{ item.name }}</span>
          
          <!-- Tooltip for collapsed sidebar -->
          <div class="absolute left-full ml-4 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none md:hidden z-50 whitespace-nowrap">
            {{ item.name }}
          </div>
        </router-link>
      </nav>

      <div class="p-4 md:p-6 mt-auto border-t border-neutral-100 dark:border-neutral-900/50">
        <div class="flex items-center gap-3 px-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-sm"></div>
          <div class="hidden md:block overflow-hidden">
            <p class="text-sm font-bold truncate">Linux User</p>
            <p class="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter">Local Host</p>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 overflow-hidden relative">
      <router-view v-slot="{ Component }">
        <transition 
          name="fade" 
          mode="out-in"
        >
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { markRaw } from 'vue'

const ChatIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
}

const ModelsIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v19"/><path d="M5 8h14"/><path d="M15 5h4"/><path d="M15 19h4"/><path d="M5 5h4"/><path d="M5 19h4"/></svg>`
}

const SettingsIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1V15a2 2 0 0 1-2-2 2 2 0 0 1 2-2v-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2v.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
}

const CloudIcon = {
  template: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-11 6.5"/></svg>`
}

const navItems = [
  { name: 'Chat', path: '/', icon: markRaw(ChatIcon) },
  { name: 'Cloud', path: '/cloud', icon: markRaw(CloudIcon) },
  { name: 'Models', path: '/models', icon: markRaw(ModelsIcon) },
  { name: 'Settings', path: '/settings', icon: markRaw(SettingsIcon) }
]
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
