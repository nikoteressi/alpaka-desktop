import { ref } from "vue";
import { useHostStore } from "../stores/hosts";
import { useConfirmationModal } from "./useConfirmationModal";

export function useHostCrud() {
  const hostStore = useHostStore();
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

  return {
    newHostName,
    newHostUrl,
    addHost,
    confirmDelete,
    modal,
    onConfirm,
    onCancel,
  };
}
