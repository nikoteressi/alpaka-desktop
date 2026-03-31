import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueVirtualScroller from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

import './style.css'
import App from './App.vue'
import router from './router'
import { initMarkdown } from './lib/markdown'

const app = createApp(App)

app.use(router)
app.use(createPinia())
app.use(VueVirtualScroller)

initMarkdown().then(() => {
  app.mount('#app')
})
