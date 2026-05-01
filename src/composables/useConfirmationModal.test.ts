import { describe, it, expect, vi } from "vitest";
import { useConfirmationModal } from "./useConfirmationModal";

describe("useConfirmationModal", () => {
  it("modal is hidden initially", () => {
    const { modal } = useConfirmationModal();
    expect(modal.show).toBe(false);
  });

  it("openModal sets all fields and shows modal", () => {
    const { modal, openModal } = useConfirmationModal();
    const onConfirm = vi.fn();

    openModal({
      title: "Delete?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      kind: "danger",
      hideCancel: true,
      onConfirm,
    });

    expect(modal.show).toBe(true);
    expect(modal.title).toBe("Delete?");
    expect(modal.message).toBe("This cannot be undone.");
    expect(modal.confirmLabel).toBe("Delete");
    expect(modal.kind).toBe("danger");
    expect(modal.hideCancel).toBe(true);
  });

  it("openModal applies defaults for optional fields", () => {
    const { modal, openModal } = useConfirmationModal();
    openModal({ title: "T", message: "M", onConfirm: vi.fn() });

    expect(modal.confirmLabel).toBe("Confirm");
    expect(modal.kind).toBe("danger");
    expect(modal.hideCancel).toBe(false);
  });

  it("onConfirm calls the handler and closes the modal", async () => {
    const { modal, openModal, onConfirm } = useConfirmationModal();
    const handler = vi.fn().mockResolvedValue(undefined);

    openModal({ title: "T", message: "M", onConfirm: handler });
    await onConfirm();

    expect(handler).toHaveBeenCalledOnce();
    expect(modal.show).toBe(false);
  });

  it("onConfirm closes modal and rethrows when handler throws", async () => {
    const { modal, openModal, onConfirm } = useConfirmationModal();
    const err = new Error("boom");
    const handler = vi.fn().mockRejectedValue(err);

    openModal({ title: "T", message: "M", onConfirm: handler });
    await expect(onConfirm()).rejects.toThrow("boom");
    expect(modal.show).toBe(false);
  });

  it("onCancel closes the modal", () => {
    const { modal, openModal, onCancel } = useConfirmationModal();
    openModal({ title: "T", message: "M", onConfirm: vi.fn() });
    expect(modal.show).toBe(true);

    onCancel();
    expect(modal.show).toBe(false);
  });
});
