import { computed } from 'vue'
import { useChatStore } from '@/stores/chat'
import type { Message } from '@/types/chat'

export function useVersionSwitcher(message: Message) {
  const store = useChatStore()

  // All messages in the active conversation
  const allMessages = computed(() =>
    store.activeConversationId
      ? (store.messages[store.activeConversationId] ?? [])
      : []
  )

  // Siblings are messages with the same parentId (including this message itself)
  // Only relevant if this message has a parentId
  const siblings = computed((): Message[] => {
    if (!message.parentId) return []
    return allMessages.value
      .filter(m => m.parentId === message.parentId)
      .sort((a, b) => (a.siblingOrder ?? 0) - (b.siblingOrder ?? 0))
  })

  const currentIndex = computed(() =>
    siblings.value.findIndex(m => m.id === message.id)
  )

  const hasPrev = computed(() => currentIndex.value > 0)
  const hasNext = computed(() => currentIndex.value < siblings.value.length - 1)
  const versionLabel = computed(() => {
    if (siblings.value.length <= 1) return null
    return `${currentIndex.value + 1} / ${siblings.value.length}`
  })

  async function prevVersion() {
    if (!hasPrev.value) return
    const prev = siblings.value[currentIndex.value - 1]
    await store.switchVersion(prev.id)
  }

  async function nextVersion() {
    if (!hasNext.value) return
    const next = siblings.value[currentIndex.value + 1]
    await store.switchVersion(next.id)
  }

  return { hasPrev, hasNext, versionLabel, prevVersion, nextVersion }
}
