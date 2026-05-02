<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const props = defineProps<{
  tabs: string[]
}>()

const activeIndex = ref(0)
const indicatorStyle = ref({ left: '0px', width: '0px' })
const tabsRef = ref<HTMLElement[]>([])

const selectTab = async (index: number) => {
  activeIndex.value = index
  await nextTick()
  updateIndicator()
}

const updateIndicator = () => {
  const activeTab = tabsRef.value[activeIndex.value]
  if (activeTab) {
    indicatorStyle.value = {
      left: `${activeTab.offsetLeft}px`,
      width: `${activeTab.offsetWidth}px`
    }
  }
}

onMounted(() => {
  // Give it a small delay to ensure fonts/layout are rendered
  setTimeout(updateIndicator, 50)
  window.addEventListener('resize', updateIndicator)
})
</script>

<template>
  <div class="animated-tabs-wrapper">
    <div class="tabs-container">
      <div class="tab-indicator" :style="indicatorStyle"></div>
      <button 
        v-for="(tab, index) in tabs" 
        :key="index"
        ref="tabsRef"
        class="tab-btn"
        :class="{ active: activeIndex === index }"
        @click="selectTab(index)"
      >
        {{ tab }}
      </button>
    </div>
    
    <div class="tab-content-wrapper mt-4">
      <transition name="fade" mode="out-in">
        <div :key="activeIndex" class="tab-content">
          <slot :name="`tab-${activeIndex}`"></slot>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.tabs-container {
  position: relative;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  width: fit-content;
  background: var(--vp-c-bg-soft);
}

.tab-btn {
  position: relative;
  z-index: 1;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  border-radius: 6px;
  transition: color 0.3s ease;
  cursor: pointer;
  background: transparent;
  border: none;
}

.tab-btn:hover {
  color: var(--vp-c-text-1);
}

.tab-btn.active {
  color: var(--vp-c-text-1);
}

.tab-indicator {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: 6px;
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  z-index: 0;
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

html:not(.dark) .tab-indicator {
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

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
