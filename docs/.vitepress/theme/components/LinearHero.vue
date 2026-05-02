<script setup lang="ts">
// Hero component for the landing page
</script>

<template>
  <div class="linear-hero text-center py-20 px-6 max-w-4xl mx-auto animate-slide-up">
    <!-- Glow effect -->
    <div class="bg-glow"></div>
    
    <h1 class="text-4xl md:text-6xl font-bold hero-title mb-6 gradient-text">
      <slot name="title">Alpaka Desktop</slot>
    </h1>
    
    <p class="text-lg md:text-xl text-gray-500 dark:text-gray-400 mb-10 leading-relaxed max-w-2xl mx-auto">
      <slot name="tagline">A first-class Ollama desktop client for Linux</slot>
    </p>
    
    <div class="flex flex-wrap items-center justify-center gap-4">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<style scoped>
.hero-title {
  letter-spacing: -0.04em;
  line-height: 1.1;
}

.gradient-text {
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-image: linear-gradient(180deg, #111 0%, #555 100%);
}

.dark .gradient-text {
  background-image: linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0.7) 100%);
}

.bg-glow {
  position: absolute;
  top: 0; left: 50%;
  width: 100vw; height: 500px;
  transform: translateX(-50%);
  background: radial-gradient(circle at top, rgba(130, 81, 238, 0.08) 0%, transparent 60%);
  pointer-events: none;
  z-index: -1;
}

.dark .bg-glow {
  background: radial-gradient(circle at top, rgba(130, 81, 238, 0.15) 0%, transparent 70%);
}

.animate-slide-up {
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
