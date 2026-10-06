<template>
  <div class="flex flex-col gap-[8px]">
    <SettingsRow v-if="dbKeyInFile" icon="key" data-testid="db-key-file-notice">
      <template #icon>
        <svg
          class="w-[14px] h-[14px] text-[var(--warning)]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </template>
      <template #label>Database key stored in a file</template>
      <template #subtitle
        >No system keyring was available when Alpaka was set up, so the key that
        encrypts your history is kept in <code>db.key</code> in the app data
        folder, readable only by your user account. Your data is still
        encrypted, but anyone who can read your files can also read the
        key.</template
      >
    </SettingsRow>

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
import { onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import SettingsRow from "../../components/settings/SettingsRow.vue";
import ConfirmationModal from "../../components/shared/ConfirmationModal.vue";
import { useConfirmationModal } from "../../composables/useConfirmationModal";

const { modal, openModal, onConfirm, onCancel } = useConfirmationModal();

const dbKeyInFile = ref(false);

onMounted(async () => {
  try {
    dbKeyInFile.value = await invoke<boolean>("get_db_key_in_file");
  } catch (err: unknown) {
    console.error("Could not read database key storage:", err);
  }
});

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
