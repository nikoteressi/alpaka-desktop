<template>
  <div
    data-testid="app-root"
    class="h-screen w-screen overflow-hidden flex"
    style="
      background: var(--bg-base);
      color: var(--text);
      font-family: var(--sans);
    "
  >
    <!-- 48px Icon strip — hidden in compact mode -->
    <div
      class="flex-shrink-0 flex flex-col items-center pt-2 pb-2 gap-1 select-none overflow-hidden transition-[width] duration-[180ms]"
      :class="settingsStore.compactMode ? 'w-0' : 'w-12'"
      :style="
        settingsStore.compactMode
          ? ''
          : 'border-right: 1px solid var(--border); background: var(--bg-base)'
      "
    >
      <!-- Sidebar toggle -->
      <button
        data-testid="sidebar-toggle"
        @click="sidebarOpen = !sidebarOpen"
        class="w-8 h-8 rounded-md border-none bg-transparent flex items-center justify-center cursor-pointer transition-colors icon-btn"
        :title="sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'"
      >
        <svg width="16" height="13" viewBox="0 0 16 13" fill="none">
          <rect
            x="0"
            y="0"
            width="4.5"
            height="13"
            rx="1.5"
            fill="currentColor"
            opacity="0.35"
          />
          <rect x="7" y="0" width="9" height="2" rx="1" fill="currentColor" />
          <rect x="7" y="5.5" width="9" height="2" rx="1" fill="currentColor" />
          <rect x="7" y="11" width="9" height="2" rx="1" fill="currentColor" />
        </svg>
      </button>

      <!-- New Chat button -->
      <CustomTooltip text="New Chat" wrapper-class="inline-flex">
        <button
          v-if="!sidebarOpen"
          @click="newChat"
          class="w-8 h-8 rounded-md border-none bg-transparent flex items-center justify-center cursor-pointer transition-colors icon-btn"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </CustomTooltip>
    </div>

    <!-- Collapsible sidebar -->
    <div
      class="flex-shrink-0 relative overflow-hidden transition-[width] select-none"
      :class="isResizing ? 'duration-0' : 'duration-[180ms]'"
      :style="{
        width: sidebarOpen ? sidebarWidth + 'px' : '0px',
        background: 'var(--bg-base)',
        borderRight: sidebarOpen ? '1px solid var(--border)' : 'none',
      }"
    >
      <!-- Inner container -->
      <div
        class="h-full flex flex-col pt-2"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <!-- Nav items -->
        <nav class="flex flex-col">
          <div
            v-for="item in navItems"
            :key="item.path"
            :data-testid="`nav-${item.path.slice(1)}`"
            class="flex items-center gap-2.5 py-[7px] px-3 mx-1.5 my-px rounded-md cursor-pointer text-[13px]"
            :class="
              isActive(item.path) ? 'nav-item--active' : 'nav-item--inactive'
            "
            @click="navigate(item)"
          >
            <component :is="item.icon" class="w-4 h-4 flex-shrink-0" />
            <CustomTooltip
              :text="item.name"
              only-if-truncated
              class="flex-1 min-w-0"
            >
              <span class="block w-full truncate">{{ item.name }}</span>
            </CustomTooltip>
            <span
              v-if="navBadges[item.path] > 0"
              class="ml-auto flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-[0_0_6px_var(--accent)]"
            >
              {{ navBadges[item.path] }}
            </span>
          </div>
        </nav>

        <!-- Conversation list — only show on chat route -->
        <template v-if="route.path === '/chat'">
          <ConversationList class="flex-1 min-h-0" />
        </template>
      </div>

      <!-- Resizer handle -->
      <div
        v-if="sidebarOpen"
        class="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-white/5 active:bg-blue-500/20 transition-colors z-50"
        @mousedown.prevent="startResize"
      ></div>
    </div>

    <!-- Main content -->
    <main class="flex-1 min-w-0 overflow-hidden flex flex-col">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { tauriApi } from "./lib/tauri";
import ConversationList from "./components/sidebar/ConversationList.vue";
import CustomTooltip from "./components/shared/CustomTooltip.vue";
import { useChatStore } from "./stores/chat";
import { useHostStore } from "./stores/hosts";
import { useModelStore } from "./stores/models";
import { useSettingsStore } from "./stores/settings";
import { useAuthStore } from "./stores/auth";
import { useAppOrchestration } from "./composables/useAppOrchestration";
import { useStreamingEvents } from "./composables/useStreamingEvents";
import { useCompactionEvents } from "./composables/useCompactionEvents";
import { useKeyboard } from "./composables/useKeyboard";
import {
  IconNewChat,
  IconLaunch,
  IconModels,
  IconSettings,
} from "./components/shared/icons";

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const hostStore = useHostStore();
const modelStore = useModelStore();
const settingsStore = useSettingsStore();
const authStore = useAuthStore();
const orchestration = useAppOrchestration();
const { init: initStreamListeners } = useStreamingEvents();
const { init: initCompactionListeners } = useCompactionEvents();
const { cleanup: cleanupKeyboard } = useKeyboard();
onUnmounted(() => cleanupKeyboard());

// Report active view to backend for smart notifications
watch(
  [() => route.meta.isChatView, () => chatStore.activeConversationId],
  ([isChat, convId]) => {
    tauriApi
      .reportActiveView(!!isChat, isChat ? convId || null : null)
      .catch(() => {});
  },
  { immediate: true },
);

// Re-check auth status when host changes
watch(
  () => hostStore.activeHostId,
  async (newHostId) => {
    if (newHostId) {
      await authStore.checkAuthStatus(newHostId).catch((err: unknown) => {
        console.error("[App] Host switch auth check failed:", err);
      });
    }
  },
);

const sidebarOpen = computed({
  get: () => !settingsStore.sidebarCollapsed && !settingsStore.compactMode,
  set: (val: boolean) => settingsStore.updateSetting("sidebarCollapsed", !val),
});
const sidebarWidth = ref(220);
const isResizing = ref(false);

function startResize() {
  if (isResizing.value) return; // prevent duplicate listener registration
  isResizing.value = true;
  globalThis.addEventListener("mousemove", doResize);
  globalThis.addEventListener("mouseup", stopResize);
  document.body.style.cursor = "col-resize";
}

function doResize(e: MouseEvent) {
  if (!isResizing.value) return;
  // Sidebar starts after 48px iconsstrip
  const newWidth = e.clientX - 48;
  if (newWidth >= 180 && newWidth <= 450) {
    sidebarWidth.value = newWidth;
  }
}

function stopResize() {
  isResizing.value = false;
  globalThis.removeEventListener("mousemove", doResize);
  globalThis.removeEventListener("mouseup", stopResize);
  document.body.style.cursor = "";
}

onUnmounted(() => {
  globalThis.removeEventListener("mousemove", doResize);
  globalThis.removeEventListener("mouseup", stopResize);
});

interface NavItem {
  name: string;
  path: string;
  icon: object;
  newChat?: boolean;
}

const navItems: NavItem[] = [
  { name: "New Chat", path: "/chat", icon: IconNewChat, newChat: true },
  { name: "Launch", path: "/launch", icon: IconLaunch },
  { name: "Models", path: "/models", icon: IconModels },
  { name: "Settings", path: "/settings", icon: IconSettings },
];

const navBadges = computed<Record<string, number>>(() => ({
  "/models": modelStore.updatesAvailableCount,
}));

function isActive(path: string): boolean {
  return route.path === path;
}

function navigate(item: NavItem) {
  if (item.newChat) {
    orchestration.startNewChat();
  }
  router.push(item.path);
}

function newChat() {
  orchestration.startNewChat();
  router.push("/chat");
}

onMounted(async () => {
  try {
    // Fire-and-forget listener registrations (synchronous side effects inside async fns)
    hostStore.initListeners().catch((err: unknown) => {
      console.error("[App] Host listeners init failed:", err);
    });
    modelStore.initListeners().catch((err: unknown) => {
      console.error("[App] Model listeners init failed:", err);
    });

    // Run parallel inits; each catches its own errors so one failure doesn't block others
    await Promise.all([
      settingsStore.initialize().catch((err: unknown) => {
        console.error("[App] Settings init failed:", err);
      }),
      hostStore.fetchHosts().catch((err: unknown) => {
        console.error("[App] Hosts fetch failed:", err);
      }),
      chatStore.loadConversations().catch((err: unknown) => {
        console.error("[App] Conversations load failed:", err);
      }),
      initStreamListeners().catch((err: unknown) => {
        console.error("[App] Stream listeners failed:", err);
      }),
      initCompactionListeners().catch((err: unknown) => {
        console.error("[App] Compaction listeners failed:", err);
      }),
      modelStore.fetchInitialUpdateStatus().catch((err: unknown) => {
        console.error("[App] Model update status fetch failed:", err);
      }),
    ]);

    // Post-init that depends on hosts being loaded
    if (hostStore.activeHostId) {
      authStore
        .checkAuthStatus(hostStore.activeHostId)
        .catch((err: unknown) => {
          console.error("[App] Initial auth check failed:", err);
        });
    }
  } catch (err) {
    console.error("[App] Critical init failure:", err);
  }
});
</script>

<style scoped>
.icon-btn {
  color: var(--text-muted);
}
.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.nav-item--active {
  background: var(--bg-hover);
  color: var(--text);
  font-weight: 500;
}
.nav-item--inactive {
  color: var(--text-muted);
}
.nav-item--inactive:hover {
  background: var(--bg-active);
  color: var(--text);
}
</style>
