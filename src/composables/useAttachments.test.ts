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

  it("handleDroppedPaths passes unknown extensions to onLinkFile", async () => {
    const onLinkFile = vi.fn().mockResolvedValue(undefined);
    const { useAttachments } = await import("./useAttachments");
    const { attachments, handleDroppedPaths } = useAttachments({ onLinkFile });
    await handleDroppedPaths(["/home/user/archive.zip"]);
    expect(attachments.value).toHaveLength(0);
    expect(onLinkFile).toHaveBeenCalledWith("/home/user/archive.zip");
  });

  it("handleDroppedPaths handles multiple files in one call", async () => {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    vi.mocked(readFile).mockResolvedValue(new Uint8Array([1]));
    const onLinkFile = vi.fn().mockResolvedValue(undefined);
    const { useAttachments } = await import("./useAttachments");
    const { attachments, handleDroppedPaths } = useAttachments({ onLinkFile });
    await handleDroppedPaths(["/a.png", "/b.md", "/c.zip"]);
    expect(attachments.value).toHaveLength(1); // only the image
    expect(onLinkFile).toHaveBeenCalledTimes(2); // .md and .zip
  });
});
