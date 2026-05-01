import { describe, it, expect, vi } from "vitest";

// jsdom doesn't implement createObjectURL — stub it with a counter so each call returns a unique URL
let urlCounter = 0;
global.URL.createObjectURL = vi.fn(() => `blob:mock-${++urlCounter}`);
global.URL.revokeObjectURL = vi.fn();

describe("useAttachments", () => {
  it("handleFiles adds image attachments with preview URLs", async () => {
    urlCounter = 0;
    const { useAttachments } = await import("./useAttachments");
    const { attachments, handleFiles } = useAttachments();

    const mockFile = new File(["x".repeat(10)], "test.png", {
      type: "image/png",
    });
    await handleFiles([mockFile]);

    expect(attachments.value).toHaveLength(1);
    expect(attachments.value[0].previewUrl).toBe("blob:mock-1");
    expect(attachments.value[0].data).toBeInstanceOf(Uint8Array);
  });

  it("removeAttachment splices the item and revokes its URL", async () => {
    urlCounter = 0;
    vi.mocked(URL.revokeObjectURL).mockClear();
    const { useAttachments } = await import("./useAttachments");
    const { attachments, handleFiles, removeAttachment } = useAttachments();

    const mockFile = new File(["x".repeat(10)], "test.png", {
      type: "image/png",
    });
    await handleFiles([mockFile]);
    expect(attachments.value).toHaveLength(1);

    removeAttachment(0);
    expect(attachments.value).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
  });

  it("non-image files are ignored", async () => {
    const { useAttachments } = await import("./useAttachments");
    const { attachments, handleFiles } = useAttachments();

    const textFile = new File(["hello"], "note.txt", { type: "text/plain" });
    await handleFiles([textFile]);
    expect(attachments.value).toHaveLength(0);
  });

  it("onDragEnter with Files type sets isDragging and increments counter", async () => {
    const { useAttachments } = await import("./useAttachments");
    const { isDragging, onDragEnter } = useAttachments();

    const evt = { dataTransfer: { types: ["Files"] } } as unknown as DragEvent;
    onDragEnter(evt);
    expect(isDragging.value).toBe(true);
  });

  it("onDragEnter without Files type does not set isDragging", async () => {
    const { useAttachments } = await import("./useAttachments");
    const { isDragging, onDragEnter } = useAttachments();

    const evt = {
      dataTransfer: { types: ["text/plain"] },
    } as unknown as DragEvent;
    onDragEnter(evt);
    expect(isDragging.value).toBe(false);
  });

  it("onDragLeave clears isDragging when all drag sources leave", async () => {
    const { useAttachments } = await import("./useAttachments");
    const { isDragging, onDragEnter, onDragLeave } = useAttachments();

    const evt = { dataTransfer: { types: ["Files"] } } as unknown as DragEvent;
    onDragEnter(evt);
    expect(isDragging.value).toBe(true);

    onDragLeave();
    expect(isDragging.value).toBe(false);
  });

  it("onDragLeave keeps isDragging true while more drag sources remain", async () => {
    const { useAttachments } = await import("./useAttachments");
    const { isDragging, onDragEnter, onDragLeave } = useAttachments();

    const evt = { dataTransfer: { types: ["Files"] } } as unknown as DragEvent;
    onDragEnter(evt);
    onDragEnter(evt);

    onDragLeave();
    expect(isDragging.value).toBe(true);
  });

  it("onDrop resets drag state and processes dropped files", async () => {
    urlCounter = 0;
    const { useAttachments } = await import("./useAttachments");
    const { attachments, isDragging, onDragEnter, onDrop } = useAttachments();

    const enterEvt = {
      dataTransfer: { types: ["Files"] },
    } as unknown as DragEvent;
    onDragEnter(enterEvt);
    expect(isDragging.value).toBe(true);

    const file = new File(["x".repeat(10)], "drop.png", { type: "image/png" });
    const dropEvt = {
      dataTransfer: { files: [file] },
    } as unknown as DragEvent;
    await onDrop(dropEvt);

    expect(isDragging.value).toBe(false);
    expect(attachments.value).toHaveLength(1);
  });

  it("onDrop handles event with no files gracefully", async () => {
    const { useAttachments } = await import("./useAttachments");
    const { attachments, onDrop } = useAttachments();

    const dropEvt = { dataTransfer: null } as unknown as DragEvent;
    await onDrop(dropEvt);
    expect(attachments.value).toHaveLength(0);
  });

  it("onPaste adds image files from clipboard items", async () => {
    urlCounter = 0;
    const { useAttachments } = await import("./useAttachments");
    const { attachments, onPaste } = useAttachments();

    const file = new File(["x".repeat(10)], "paste.png", { type: "image/png" });
    const pasteEvt = {
      clipboardData: {
        items: [{ type: "image/png", getAsFile: () => file }],
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;
    await onPaste(pasteEvt);

    expect(attachments.value).toHaveLength(1);
  });

  it("onPaste ignores clipboard items that are not images", async () => {
    const { useAttachments } = await import("./useAttachments");
    const { attachments, onPaste } = useAttachments();

    const pasteEvt = {
      clipboardData: {
        items: [{ type: "text/plain", getAsFile: () => null }],
      },
      preventDefault: vi.fn(),
    } as unknown as ClipboardEvent;
    await onPaste(pasteEvt);

    expect(attachments.value).toHaveLength(0);
  });

  it("onPaste does nothing when clipboardData is absent", async () => {
    const { useAttachments } = await import("./useAttachments");
    const { attachments, onPaste } = useAttachments();

    const pasteEvt = { clipboardData: null } as unknown as ClipboardEvent;
    await onPaste(pasteEvt);
    expect(attachments.value).toHaveLength(0);
  });

  it("clearAttachments removes all items and revokes all URLs", async () => {
    urlCounter = 0;
    vi.mocked(URL.revokeObjectURL).mockClear();

    const { useAttachments } = await import("./useAttachments");
    const { attachments, handleFiles, clearAttachments } = useAttachments();

    const file1 = new File(["x".repeat(10)], "a.png", { type: "image/png" });
    const file2 = new File(["y".repeat(10)], "b.png", { type: "image/png" });
    await handleFiles([file1, file2]);
    expect(attachments.value).toHaveLength(2);

    clearAttachments();
    expect(attachments.value).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-2");
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
