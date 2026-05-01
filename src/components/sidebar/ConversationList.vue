<template>
  <div class="flex flex-col min-h-0">
    <!-- Sidebar header: title + search toggle -->
    <div class="flex items-center gap-1 px-2 py-1.5 flex-shrink-0">
      <template v-if="isSearchOpen">
        <div
          class="flex-1 min-w-0 flex items-center gap-1.5 px-2.5 py-1 bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg"
        >
          <svg
            class="w-3 h-3 text-[var(--text-dim)] flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref="searchInput"
            v-model="searchQuery"
            placeholder="Search…"
            class="flex-1 min-w-0 bg-transparent text-[12px] text-[var(--text)] placeholder-[var(--text-dim)] outline-none"
            @keydown.escape.prevent="closeSearch"
          />
        </div>
        <button
          @click="closeSearch"
          class="flex-shrink-0 p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-active)] transition-colors cursor-pointer"
        >
          <svg
            class="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </template>
      <template v-else>
        <span
          class="flex-1 min-w-0 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-1 select-none truncate"
        >
          Conversations
        </span>
        <CustomTooltip text="Search conversations (Ctrl+K)">
          <button
            @click="openSearch"
            class="flex-shrink-0 p-1 rounded text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-active)] transition-colors cursor-pointer"
          >
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </button>
        </CustomTooltip>
      </template>
    </div>

    <DynamicScroller
      :items="flattenedItems"
      :min-item-size="32"
      key-field="id"
      class="flex-1 w-full pr-1"
    >
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          v-if="isScrollerItem(item)"
          :item="item"
          :active="active"
          :size-dependencies="[
            item.conversation?.title,
            item.conversation?.pinned,
            item.conversation?.id === activeConversationId,
            renamingId,
            menuOpenId,
          ]"
          :data-index="index"
        >
          <!-- Group Header -->
          <div
            v-if="item.type === 'header'"
            class="mx-4 pb-1.5 mb-2 border-b border-[var(--border-strong)] text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider select-none px-[2px]"
            :class="index === 0 ? 'pt-4' : 'pt-6'"
          >
            {{ item.label }}
          </div>

          <!-- Conversation Item -->
          <div
            v-else-if="item.type === 'conversation' && item.conversation"
            class="group relative flex items-center px-3 py-[8px] mx-1.5 rounded-md cursor-pointer text-[13px] whitespace-nowrap transition-colors select-none"
            :class="
              item.conversation.id === activeConversationId
                ? 'bg-[var(--bg-hover)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'
            "
            @click="selectConv(item.conversation.id)"
            @dblclick="startRename(item.conversation)"
            @contextmenu.prevent="openContextMenu($event, item.conversation)"
          >
            <!-- Pin Icon for Pinned Items -->
            <svg
              v-if="item.conversation.pinned"
              class="flex-shrink-0 w-2.5 h-2.5 text-[var(--text-dim)] mr-2"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>

            <!-- Rename Input -->
            <input
              v-if="renamingId === item.conversation.id"
              ref="renameInput"
              v-model="renameValue"
              class="flex-1 min-w-0 bg-[var(--bg-base)] text-[var(--text)] text-[13px] px-1.5 py-0.5 rounded outline-none ring-1 ring-[var(--accent)]"
              @blur="commitRename(item.conversation.id)"
              @keydown.enter.prevent="commitRename(item.conversation.id)"
              @keydown.escape.prevent="cancelRename"
              @click.stop
            />

            <!-- Conversation Title with Tooltip -->
            <CustomTooltip
              v-else
              :text="item.conversation.title"
              only-if-truncated
              class="flex-1 min-w-0"
            >
              <span class="block w-full truncate">{{
                item.conversation.title
              }}</span>
            </CustomTooltip>

            <!-- Menu Button -->
            <button
              class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--bg-active)] text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-all ml-auto"
              :class="
                item.conversation.id === activeConversationId ||
                menuOpenId === item.conversation.id
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100'
              "
              @click.stop="toggleMenu($event, item.conversation.id)"
            >
              <svg class="w-3" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>

          <!-- Loading Sentinel -->
          <div
            v-else-if="item.type === 'loading'"
            :ref="setSentinel"
            class="h-8 flex items-center justify-center"
          >
            <div
              v-if="chatStore.isLoadingMore"
              class="w-4 h-4 border-2 border-[var(--border-strong)] border-t-white rounded-full animate-spin"
            ></div>
          </div>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <!-- Floating dropdown menu (teleported to body to avoid overflow clipping) -->
    <Teleport to="body">
      <div
        v-if="menuOpenId && menuPosition"
        ref="menuRef"
        class="fixed z-[9999] w-40 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] py-1 text-[12px]"
        :style="{ top: menuPosition.y + 'px', left: menuPosition.x + 'px' }"
        @click.stop
      >
        <button
          class="w-full text-left px-3 py-1.5 text-[var(--text)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors cursor-pointer"
          @click="doRename"
        >
          <span class="flex items-center gap-2">
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 20h9" />
              <path
                d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
              />
            </svg>
            Rename
          </span>
        </button>
        <button
          class="w-full text-left px-3 py-1.5 text-[var(--text)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)] transition-colors cursor-pointer"
          @click="doTogglePin"
        >
          <span class="flex items-center gap-2">
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 17v5" />
              <path
                d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"
              />
            </svg>
            {{ menuConv?.pinned ? "Unpin" : "Pin" }}
          </span>
        </button>
        <div class="my-0.5 border-t border-[var(--border-strong)]"></div>
        <button
          class="w-full text-left px-3 py-1.5 text-[var(--danger)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          @click="doDelete"
        >
          <span class="flex items-center gap-2">
            <svg
              class="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path
                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
              />
            </svg>
            Delete
          </span>
        </button>
      </div>
    </Teleport>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :show="modal.show"
      :title="modal.title"
      :message="modal.message"
      :confirm-label="modal.confirmLabel"
      :kind="modal.kind"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from "vue";
import { DynamicScroller, DynamicScrollerItem } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import ConfirmationModal from "../shared/ConfirmationModal.vue";
import CustomTooltip from "../shared/CustomTooltip.vue";
import { useChatStore } from "../../stores/chat";
import { useConversationLifecycle } from "../../composables/useConversationLifecycle";
import { useConfirmationModal } from "../../composables/useConfirmationModal";
import { appEvents, APP_EVENT } from "../../lib/appEvents";
import type { Conversation } from "../../types/chat";

interface ScrollerItem {
  id: string;
  type: "header" | "conversation" | "loading";
  label?: string;
  conversation?: Conversation;
}

function isScrollerItem(item: unknown): item is ScrollerItem {
  return !!item && typeof item === "object" && "id" in item;
}

const props = defineProps<{
  filterIds?: string[];
}>();

const chatStore = useChatStore();
const { updateTitle, setPinned, deleteConversation } =
  useConversationLifecycle();
const { modal, openModal, onConfirm, onCancel } = useConfirmationModal();

const unpinnedConversations = computed(() => {
  const base = props.filterIds
    ? chatStore.conversations.filter((c) => props.filterIds?.includes(c.id))
    : chatStore.conversations;
  const unpinned = base.filter((c) => !c.pinned);
  if (!searchQuery.value.trim()) return unpinned;
  const q = searchQuery.value.toLowerCase();
  return unpinned.filter((c) => c.title.toLowerCase().includes(q));
});

const pinnedConversations = computed(() => {
  const base = props.filterIds
    ? chatStore.conversations.filter((c) => props.filterIds?.includes(c.id))
    : chatStore.conversations;
  const pinned = base.filter((c) => c.pinned);
  if (!searchQuery.value.trim()) return pinned;
  const q = searchQuery.value.toLowerCase();
  return pinned.filter((c) => c.title.toLowerCase().includes(q));
});

const chatGroups = computed(() => {
  const groups: { label: string; conversations: Conversation[] }[] = [
    { label: "Today", conversations: [] },
    { label: "Yesterday", conversations: [] },
    { label: "Last 7 Days", conversations: [] },
    { label: "This Month", conversations: [] },
    { label: "Older", conversations: [] },
  ];

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  unpinnedConversations.value.forEach((c) => {
    const date = new Date(c.updated_at);
    if (date >= today) {
      groups[0].conversations.push(c);
    } else if (date >= yesterday) {
      groups[1].conversations.push(c);
    } else if (date >= lastWeek) {
      groups[2].conversations.push(c);
    } else if (date >= thisMonth) {
      groups[3].conversations.push(c);
    } else {
      groups[4].conversations.push(c);
    }
  });

  return groups.filter((g) => g.conversations.length > 0);
});

const flattenedItems = computed<ScrollerItem[]>(() => {
  const items: ScrollerItem[] = [];

  // Pinned chats (always ungrouped at top)
  if (pinnedConversations.value.length > 0) {
    items.push({ id: "header-pinned", type: "header", label: "Pinned" });
    pinnedConversations.value.forEach((conv) => {
      items.push({
        id: `conv-${conv.id}`,
        type: "conversation",
        conversation: conv,
      });
    });
  }

  // Chronological groups
  chatGroups.value.forEach((group) => {
    items.push({
      id: `header-${group.label}`,
      type: "header",
      label: group.label,
    });
    group.conversations.forEach((conv) => {
      items.push({
        id: `conv-${conv.id}`,
        type: "conversation",
        conversation: conv,
      });
    });
  });

  // Infinite Scroll Sentinel
  items.push({ id: "sentinel-loading", type: "loading" });

  return items;
});

const activeConversationId = computed(() => chatStore.activeConversationId);

const renamingId = ref<string | null>(null);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

const isSearchOpen = ref(false);
const searchQuery = ref("");
const searchInput = ref<HTMLInputElement | null>(null);

function openSearch() {
  if (isSearchOpen.value) {
    searchInput.value?.focus();
    return;
  }
  isSearchOpen.value = true;
  nextTick(() => searchInput.value?.focus());
}

function closeSearch() {
  isSearchOpen.value = false;
  searchQuery.value = "";
}

const menuOpenId = ref<string | null>(null);
const menuPosition = ref<{ x: number; y: number } | null>(null);
const menuRef = ref<HTMLElement | null>(null);

let observer: IntersectionObserver | null = null;

/** The conversation object for the currently open menu */
const menuConv = computed(() =>
  menuOpenId.value
    ? (chatStore.conversations.find((c) => c.id === menuOpenId.value) ?? null)
    : null,
);

function selectConv(id: string) {
  if (renamingId.value) return;
  chatStore.loadConversation(id);
}

function startRename(conv: Conversation) {
  renamingId.value = conv.id;
  renameValue.value = conv.title;
  nextTick(() => {
    const el = Array.isArray(renameInput.value)
      ? renameInput.value[0]
      : renameInput.value;
    el?.focus();
    el?.select();
  });
}

async function commitRename(id: string) {
  if (!renamingId.value) return;
  const title = renameValue.value.trim();
  renamingId.value = null;
  if (title) {
    try {
      await updateTitle(id, title);
    } catch (err) {
      console.error("Failed to update title:", err);
    }
  }
}

function cancelRename() {
  renamingId.value = null;
}

function toggleMenu(e: MouseEvent, id: string) {
  if (menuOpenId.value === id) {
    closeMenuNow();
    return;
  }
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  menuOpenId.value = id;
  menuPosition.value = {
    x: Math.min(rect.right, window.innerWidth - 170),
    y: rect.bottom + 4,
  };
}

function openContextMenu(e: MouseEvent, conv: Conversation) {
  menuOpenId.value = conv.id;
  menuPosition.value = {
    x: Math.min(e.clientX, window.innerWidth - 170),
    y: Math.min(e.clientY, window.innerHeight - 140),
  };
}

function closeMenuNow() {
  menuOpenId.value = null;
  menuPosition.value = null;
}

function doRename() {
  if (!menuConv.value) return;
  const conv = menuConv.value;
  closeMenuNow();
  startRename(conv);
}

async function doTogglePin() {
  if (!menuConv.value) return;
  await setPinned(menuConv.value.id, !menuConv.value.pinned);
  closeMenuNow();
}

function doDelete() {
  if (!menuConv.value) return;
  const conv = menuConv.value;
  closeMenuNow();
  openModal({
    title: "Confirm Delete",
    message: `Delete '${conv.title}'? This cannot be undone.`,
    confirmLabel: "Delete",
    kind: "danger",
    onConfirm: () => deleteConversation(conv.id),
  });
}

function closeMenu(e: MouseEvent) {
  if (menuOpenId.value) {
    const menuEl = menuRef.value;
    if (menuEl && menuEl.contains(e.target as Node)) return;
    closeMenuNow();
  }
}

onMounted(() => {
  document.addEventListener("mousedown", closeMenu);
  appEvents.addEventListener(APP_EVENT.FOCUS_SEARCH, openSearch);

  // Setup infinite scroll
  observer = new IntersectionObserver(
    (entries) => {
      if (
        entries[0].isIntersecting &&
        chatStore.hasMore &&
        !chatStore.isLoadingMore
      ) {
        chatStore.loadConversations();
      }
    },
    { rootMargin: "200px" },
  ); // Increased margin for smoother virtual loading
});

// Function ref for the sentinel to ensure it's observed when rendered by the virtual scroller
function setSentinel(el: unknown) {
  if (el) {
    const element = (el as { $el?: Element }).$el || (el as Element);
    observer?.observe(element);
  }
}

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", closeMenu);
  appEvents.removeEventListener(APP_EVENT.FOCUS_SEARCH, openSearch);
  if (observer) observer.disconnect();
});
</script>
