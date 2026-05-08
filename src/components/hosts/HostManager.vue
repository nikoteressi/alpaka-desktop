<template>
  <BaseModal
    :show="hostStore.isHostManagerOpen"
    title="Hosts Manager"
    max-width="480px"
    @close="hostStore.isHostManagerOpen = false"
  >
    <div class="px-5 py-4 flex flex-col gap-4">
      <!-- Host list -->
      <div
        v-if="hostStore.hosts.length === 0"
        class="text-[12px] text-[var(--text-dim)] text-center py-2"
      >
        No hosts configured
      </div>
      <div
        v-for="host in hostStore.hosts"
        :key="host.id"
        class="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0"
      >
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :class="
              host.last_ping_status === 'online'
                ? 'bg-[var(--success)]'
                : host.last_ping_status === 'offline'
                  ? 'bg-[var(--danger)]'
                  : 'bg-[var(--text-dim)]'
            "
          />
          <div class="min-w-0">
            <p
              class="text-[13px] text-[var(--text)] font-medium truncate flex items-center gap-1.5"
            >
              {{ host.name }}
              <span
                v-if="host.is_active"
                class="text-[10px] text-[var(--accent)]"
                >Active</span
              >
            </p>
            <p class="text-[11px] text-[var(--text-dim)] font-mono truncate">
              {{ host.url }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <button
            v-if="!host.is_active"
            @click="orchestration.switchHost(host.id)"
            class="px-2.5 py-1 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-md text-[var(--text)] text-[11px] cursor-pointer hover:bg-[var(--bg-active)] transition-colors"
          >
            Connect
          </button>
          <CustomTooltip text="Delete host" wrapper-class="inline-block">
            <button
              @click="confirmDelete(host.id, host.is_active)"
              class="text-[var(--text-dim)] hover:text-[var(--danger)] transition-colors cursor-pointer p-1"
            >
              <svg
                width="13"
                height="13"
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
            </button>
          </CustomTooltip>
        </div>
      </div>

      <!-- Add host form -->
      <div class="border-t border-[var(--border-subtle)] pt-3">
        <p
          class="text-[11px] text-[var(--text-dim)] font-medium uppercase tracking-[0.06em] mb-2"
        >
          Add New Host
        </p>
        <div class="flex flex-col gap-2">
          <input
            v-model="newHostName"
            placeholder="Display name"
            class="custom-input w-full"
          />
          <input
            v-model="newHostUrl"
            placeholder="http://192.168.1.100:11434"
            class="custom-input w-full font-mono"
          />
          <button
            @click="addHost"
            :disabled="!newHostName.trim() || !newHostUrl.trim()"
            class="px-4 py-1.5 bg-[var(--bg-user-msg)] border border-[var(--border-strong)] rounded-lg text-[var(--text)] text-[12px] font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-active)] transition-colors"
          >
            Add Host
          </button>
        </div>
      </div>
    </div>

    <ConfirmationModal
      :show="modal.show"
      :title="modal.title"
      :message="modal.message"
      :confirm-label="modal.confirmLabel"
      :kind="modal.kind"
      :hide-cancel="modal.hideCancel"
      @confirm="onConfirm"
      @cancel="onCancel"
    />
  </BaseModal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import BaseModal from "../shared/BaseModal.vue";
import ConfirmationModal from "../shared/ConfirmationModal.vue";
import CustomTooltip from "../shared/CustomTooltip.vue";
import { useHostStore } from "../../stores/hosts";
import { useAppOrchestration } from "../../composables/useAppOrchestration";
import { useConfirmationModal } from "../../composables/useConfirmationModal";

const hostStore = useHostStore();
const orchestration = useAppOrchestration();
const { modal, openModal, onConfirm, onCancel } = useConfirmationModal();

const newHostName = ref("");
const newHostUrl = ref("");

async function addHost() {
  if (!newHostName.value.trim() || !newHostUrl.value.trim()) return;
  await hostStore.addHost(newHostName.value.trim(), newHostUrl.value.trim());
  newHostName.value = "";
  newHostUrl.value = "";
}

function confirmDelete(id: string, isActive: boolean) {
  if (isActive) {
    openModal({
      title: "Action Prohibited",
      message:
        "You cannot delete the active host. Please switch to another host first.",
      confirmLabel: "OK",
      kind: "info",
      hideCancel: true,
      onConfirm: () => {},
    });
    return;
  }

  openModal({
    title: "Confirm Delete",
    message: "Are you sure you want to delete this host?",
    confirmLabel: "Delete",
    kind: "danger",
    onConfirm: () => hostStore.deleteHost(id),
  });
}
</script>
