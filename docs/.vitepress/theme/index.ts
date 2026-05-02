import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import { watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
import './custom.css'

import SpotlightCard from './components/SpotlightCard.vue'
import AnimatedTabs from './components/AnimatedTabs.vue'
import LinearHero from './components/LinearHero.vue'
import InterfaceMockup from './components/InterfaceMockup.vue'

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()
    watch(() => route.path, async () => {
      await nextTick()
      const doc = document.querySelector('.VPDoc')
      if (doc) {
        doc.classList.remove('animate-page')
        void (doc as HTMLElement).offsetWidth // force reflow
        doc.classList.add('animate-page')
      }
    }, { immediate: true })
  },
  enhanceApp({ app }) {
    app.component('SpotlightCard', SpotlightCard)
    app.component('AnimatedTabs', AnimatedTabs)
    app.component('LinearHero', LinearHero)
    app.component('InterfaceMockup', InterfaceMockup)
  }
} satisfies Theme
