<template>
  <div class="flex flex-col gap-[8px]">
    <SettingsRow icon="database">
      <template #label>Backup Database</template>
      <template #subtitle
        >Save a copy of your chat history and settings to a local
        file.</template
      >
      <template #control>
        <button
          @click="backupDatabase"
          class="px-4 py-1.5 bg-[var(--bg-hover)] border border-[var(--border-strong)] rounded-lg text-[12px] text-[var(--text)] cursor-pointer hover:bg-[var(--bg-active)] transition-colors flex-shrink-0"
        >
          Run Backup
        </button>
      </template>
    </SettingsRow>

    <SettingsRow icon="database">
      <template #label>Restore Database</template>
      <template #subtitle
        >Restore history and settings from a backup file. Your current data will
        be overwritten.</template
      >
      <template #control>
        <button
          @click="confirmRestore"
          class="px-4 py-1.5 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg text-[var(--danger)] text-[12px] font-bold cursor-pointer hover:bg-[var(--danger)] hover:text-white transition-all flex-shrink-0"
        >
          Restore
        </button>
      </template>
    </SettingsRow>

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
import { invoke } from "@tauri-apps/api/core";
import SettingsRow from "../../components/settings/SettingsRow.vue";
import ConfirmationModal from "../../components/shared/ConfirmationModal.vue";
import { useConfirmationModal } from "../../composables/useConfirmationModal";

const { modal, openModal, onConfirm, onCancel } = useConfirmationModal();

async function backupDatabase() {
  try {
    await invoke("backup_database");
  } catch (err: unknown) {
    console.error("Backup failed:", err);
  }
}

function confirmRestore() {
  openModal({
    title: "Restore Database?",
    message:
      "All current chat history and settings will be replaced by the backup. A safety backup of your CURRENT data will be created automatically in the app directory.",
    confirmLabel: "Restore Now",
    kind: "danger",
    onConfirm: async () => {
      try {
        await invoke("restore_database");
        globalThis.location.reload();
      } catch (err: unknown) {
        console.error("Restore failed:", err);
      }
    },
  });
}
</script>
