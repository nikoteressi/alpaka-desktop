<script setup lang="ts">
import { ref } from 'vue'

const cardRef = ref<HTMLElement | null>(null)
const mouseX = ref(0)
const mouseY = ref(0)

const handleMouseMove = (e: MouseEvent) => {
  if (!cardRef.value) return
  const rect = cardRef.value.getBoundingClientRect()
  mouseX.value = e.clientX - rect.left
  mouseY.value = e.clientY - rect.top
}
</script>

<template>
  <div 
    ref="cardRef"
    class="spotlight-card p-6"
    @mousemove="handleMouseMove"
    :style="{ '--mouse-x': `${mouseX}px`, '--mouse-y': `${mouseY}px` }"
  >
    <div class="spotlight-content">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.spotlight-card {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  transition: transform 0.3s ease;
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-border);
}

.dark .spotlight-card {
  box-shadow: none;
}

html:not(.dark) .spotlight-card {
  box-shadow: 0 4px 6px rgba(0,0,0,0.02);
}

.spotlight-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(800px circle at var(--mouse-x, 0) var(--mouse-y, 0), rgba(130, 81, 238, 0.1), transparent 40%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 0;
}

.spotlight-card:hover::before {
  opacity: 1;
}

.spotlight-content {
  position: relative;
  z-index: 1;
}
</style>
