import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
}));

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

  // handleDroppedPaths tests

  it("handleDroppedPaths attaches image paths as binary attachments", async () => {
    urlCounter = 0;
    const { readFile } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readFile).mockResolvedValue(new Uint8Array([1, 2, 3]));
    const { useAttachments } = await import("./useAttachments");
    const { attachments, handleDroppedPaths } = useAttachments();
    await handleDroppedPaths(["/home/user/photo.png"]);
    expect(attachments.value).toHaveLength(1);
    expect(attachments.value[0].data).toBeInstanceOf(Uint8Array);
    expect(readFile).toHaveBeenCalledWith("/home/user/photo.png");
  });

  it("handleDroppedPaths calls onLinkFile for text file paths", async () => {
    const onLinkFile = vi.fn().mockResolvedValue(undefined);
    const { useAttachments } = await import("./useAttachments");
    const { handleDroppedPaths } = useAttachments({ onLinkFile });
    await handleDroppedPaths(["/home/user/notes.md"]);
    expect(onLinkFile).toHaveBeenCalledWith("/home/user/notes.md");
  });

  it("handleDroppedPaths skips unknown extensions silently", async () => {
    const onLinkFile = vi.fn();
    const { useAttachments } = await import("./useAttachments");
    const { attachments, handleDroppedPaths } = useAttachments({ onLinkFile });
    await handleDroppedPaths(["/home/user/archive.zip"]);
    expect(attachments.value).toHaveLength(0);
    expect(onLinkFile).not.toHaveBeenCalled();
  });

  it("handleDroppedPaths handles multiple files in one call", async () => {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readFile).mockResolvedValue(new Uint8Array([1]));
    const onLinkFile = vi.fn().mockResolvedValue(undefined);
    const { useAttachments } = await import("./useAttachments");
    const { attachments, handleDroppedPaths } = useAttachments({ onLinkFile });
    await handleDroppedPaths(["/a.png", "/b.md", "/c.txt"]);
    expect(attachments.value).toHaveLength(1); // only the image
    expect(onLinkFile).toHaveBeenCalledTimes(2); // .md and .txt
  });

  // onGlobalPaste tests

  it("onGlobalPaste attaches image from clipboard image data", async () => {
    urlCounter = 0;
    const { useAttachments } = await import("./useAttachments");
    const { attachments, onGlobalPaste } = useAttachments();
    const file = new File(["x".repeat(10)], "img.png", { type: "image/png" });
    const evt = {
      clipboardData: {
        items: [{ type: "image/png", getAsFile: () => file }],
        getData: () => "",
      },
      preventDefault: vi.fn(),
      target: document.createElement("div"),
    } as unknown as ClipboardEvent;
    await onGlobalPaste(evt);
    expect(attachments.value).toHaveLength(1);
  });

  it("onGlobalPaste links text files from uri-list", async () => {
    const onLinkFile = vi.fn().mockResolvedValue(undefined);
    const { useAttachments } = await import("./useAttachments");
    const { onGlobalPaste } = useAttachments({ onLinkFile });
    const evt = {
      clipboardData: {
        items: [],
        getData: (type: string) =>
          type === "text/uri-list" ? "file:///home/user/notes.md\n" : "",
      },
      preventDefault: vi.fn(),
      target: document.createElement("div"),
    } as unknown as ClipboardEvent;
    await onGlobalPaste(evt);
    expect(onLinkFile).toHaveBeenCalledWith("/home/user/notes.md");
  });

  it("onGlobalPaste is suppressed when a textarea is focused", async () => {
    const onLinkFile = vi.fn();
    const { useAttachments } = await import("./useAttachments");
    const { onGlobalPaste } = useAttachments({ onLinkFile });
    const ta = document.createElement("textarea");
    const evt = {
      clipboardData: {
        items: [],
        getData: () => "file:///home/user/notes.md",
      },
      preventDefault: vi.fn(),
      target: ta,
    } as unknown as ClipboardEvent;
    await onGlobalPaste(evt);
    expect(onLinkFile).not.toHaveBeenCalled();
  });
});
