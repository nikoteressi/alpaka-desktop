<template>
  <div class="h-full flex flex-col p-8 overflow-y-auto bg-white dark:bg-[#0F0F0F] selection:bg-[#FF6B35] selection:text-white">
    <div class="max-w-4xl mx-auto w-full">
      <header class="mb-12">
        <div class="flex items-center gap-4 mb-4">
          <div class="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-2xl text-[#FF6B35] border border-orange-100 dark:border-orange-900/50">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a3.5 3.5 0 0 0 0-7h-1.5a7 7 0 1 0-11 6.5"/></svg>
          </div>
          <h1 class="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-500 dark:from-white dark:to-neutral-500">
            Cloud
          </h1>
        </div>
        <p class="text-neutral-500 dark:text-neutral-400 text-lg font-medium">Sync your models and history across devices with Ollama Cloud.</p>
      </header>

      <section class="relative overflow-hidden p-10 md:p-14 rounded-[3rem] bg-neutral-900 dark:bg-white text-white dark:text-black">
        <div class="relative z-10 max-w-lg">
          <h2 class="text-3xl font-black mb-4 tracking-tight">Coming Soon</h2>
          <p class="text-neutral-400 dark:text-neutral-500 text-lg mb-8 leading-relaxed">
            We're building a seamless way to access your private models and synchronize your conversations securely.
          </p>
          <button class="px-8 py-4 bg-[#FF6B35] hover:bg-[#E85D2C] text-white rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20 active:scale-95">
            Notify me when it's ready
          </button>
        </div>
        
        <!-- Decorative elements -->
        <div class="absolute top-0 right-0 w-64 h-64 bg-[#FF6B35]/20 blur-[100px] -mr-32 -mt-32"></div>
        <div class="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 blur-[80px] -ml-24 -mb-24"></div>
      </section>

      <div class="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 font-medium">
        <div class="p-8 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
          <h3 class="text-xl font-bold mb-3 tracking-tight">Private Model Storage</h3>
          <p class="text-neutral-500 dark:text-neutral-400 leading-relaxed">Push and pull models to your own private registry on Ollama Cloud.</p>
        </div>
        <div class="p-8 rounded-[2rem] border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
          <h3 class="text-xl font-bold mb-3 tracking-tight">Secure Syncing</h3>
          <p class="text-neutral-500 dark:text-neutral-400 leading-relaxed">End-to-end encrypted synchronization of your chat history and preferences.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Logic for Cloud integration will be added in Phase 2
</script>
