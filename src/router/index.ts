import { createRouter, createWebHashHistory } from 'vue-router'
import ChatPage from '../views/ChatPage.vue'
import ModelsPage from '../views/ModelsPage.vue'
import SettingsPage from '../views/SettingsPage.vue'

const routes = [
  {
    path: '/',
    name: 'chat',
    component: ChatPage,
    meta: {
      title: 'Chat'
    }
  },
  {
    path: '/models',
    name: 'models',
    component: ModelsPage,
    meta: {
      title: 'Models'
    }
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: {
      title: 'Settings'
    }
  },
  {
    path: '/cloud',
    name: 'cloud',
    component: () => import('../views/CloudPage.vue'),
    meta: {
      title: 'Cloud'
    }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
