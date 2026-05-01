import { reactive } from "vue";

export interface ModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  kind?: "danger" | "warning" | "info";
  hideCancel?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function useConfirmationModal() {
  const modal = reactive({
    show: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    kind: "danger" as "danger" | "warning" | "info",
    hideCancel: false,
    onConfirm: (() => {}) as () => void | Promise<void>,
  });

  function openModal(opts: ModalOptions) {
    modal.title = opts.title;
    modal.message = opts.message;
    modal.confirmLabel = opts.confirmLabel ?? "Confirm";
    modal.kind = opts.kind ?? "danger";
    modal.hideCancel = opts.hideCancel ?? false;
    modal.onConfirm = opts.onConfirm;
    modal.show = true;
  }

  async function onConfirm() {
    try {
      await modal.onConfirm();
      modal.show = false;
    } catch (error) {
      console.error("[ConfirmationModal] Confirm action failed:", error);
      // Still close the modal so the user isn't stuck
      modal.show = false;
      throw error;
    }
  }

  function onCancel() {
    modal.show = false;
  }

  return { modal, openModal, onConfirm, onCancel };
}
