import { createRouter, createWebHashHistory } from "vue-router";
import ChatPage from "../views/ChatPage.vue";
import ModelsPage from "../views/ModelsPage.vue";
import SettingsPage from "../views/SettingsPage.vue";
import { useChatStore } from "../stores/chat";

const routes = [
  {
    path: "/",
    redirect: "/launch",
  },
  {
    path: "/chat",
    name: "chat",
    component: ChatPage,
    meta: {
      title: "Chat",
      isChatView: true,
    },
  },
  {
    path: "/models",
    name: "models",
    component: ModelsPage,
    meta: {
      title: "Models",
    },
  },
  {
    path: "/settings",
    name: "settings",
    component: SettingsPage,
    meta: {
      title: "Settings",
    },
  },
  {
    path: "/launch",
    name: "launch",
    component: () => import("../views/LaunchPage.vue"),
    meta: {
      title: "Launch",
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    redirect: "/",
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  try {
    const chatStore = useChatStore();
    if (chatStore.streaming?.isStreaming) {
      const leavingChat =
        from.path === "/" || from.path.includes("chat") || from.name === "chat";
      if (leavingChat) {
        const confirmed = window.confirm(
          "A response is currently generating. Leave anyway?",
        );
        if (!confirmed) return next(false);
      }
    }
  } catch {
    // Store not ready yet — allow navigation
  }
  next();
});

export default router;
