import { ref } from "vue";

export interface Attachment {
  file: File;
  previewUrl: string;
  data: Uint8Array | null;
}

export interface AttachmentsOptions {
  onLinkFile?: (path: string) => Promise<void>;
}

const IMAGE_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".tiff",
]);

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
};

function extOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot).toLowerCase() : "";
}

function mimeFromExt(ext: string): string {
  return MIME_MAP[ext] ?? "application/octet-stream";
}

function parseUriList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .filter((line) => line.startsWith("file://"))
    .map((line) => decodeURIComponent(line.slice("file://".length)));
}

async function rgbaToFile(
  rgba: Uint8Array,
  width: number,
  height: number,
): Promise<File | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(rgba), width, height),
      0,
      0,
    );
    canvas.toBlob(
      (blob) =>
        resolve(
          blob
            ? new File([blob], "pasted-image.png", { type: "image/png" })
            : null,
        ),
      "image/png",
    );
  });
}

async function readClipboardImageViaNavigator(): Promise<File | null> {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (imageType) {
        const blob = await item.getType(imageType);
        return new File([blob], "pasted-image.png", {
          type: blob.type || "image/png",
        });
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function readClipboardImageViaTauri(): Promise<File | null> {
  try {
    const { readImage } = await import("@tauri-apps/plugin-clipboard-manager");
    const img = await readImage();
    const [rgba, { width, height }] = await Promise.all([
      img.rgba(),
      img.size(),
    ]);
    return rgbaToFile(rgba, width, height);
  } catch {
    return null;
  }
}

async function readClipboardImage(): Promise<File | null> {
  return (
    (await readClipboardImageViaNavigator()) ??
    (await readClipboardImageViaTauri())
  );
}

export function useAttachments(options: AttachmentsOptions = {}) {
  const attachments = ref<Attachment[]>([]);
  const isDragging = ref(false);

  async function handleFiles(files: FileList | File[]) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        const previewUrl = URL.createObjectURL(file);
        const data = new Uint8Array(await file.arrayBuffer());
        attachments.value.push({ file, previewUrl, data });
      }
    }
  }

  function removeAttachment(index: number) {
    if (attachments.value[index].previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(attachments.value[index].previewUrl);
    }
    attachments.value.splice(index, 1);
  }

  function clearAttachments() {
    attachments.value.forEach((a) => {
      if (a.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(a.previewUrl);
      }
    });
    attachments.value = [];
  }

  async function handleDroppedPaths(paths: string[]) {
    isDragging.value = false;
    await Promise.all(
      paths.map(async (path) => {
        const ext = extOf(path);
        if (IMAGE_EXTS.has(ext)) {
          const { readFile } = await import("@tauri-apps/plugin-fs");
          const bytes = await readFile(path);
          const name = path.split("/").pop() ?? "image";
          const file = new File([bytes], name, { type: mimeFromExt(ext) });
          const previewUrl = URL.createObjectURL(file);
          attachments.value.push({ file, previewUrl, data: bytes });
        } else if (options.onLinkFile) {
          await options.onLinkFile(path);
        }
      }),
    );
  }

  async function onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await handleFiles(imageFiles);
    }
  }

  async function onGlobalPaste(e: ClipboardEvent) {
    // Collect ALL clipboard data synchronously before any await —
    // WebKitGTK invalidates clipboardData after the synchronous portion returns.

    // 1. Image items from web clipboard API (may be empty on WebKitGTK for images)
    const items = e.clipboardData?.items;
    const webImageFiles: File[] = [];
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const f = items[i].getAsFile();
          if (f) webImageFiles.push(f);
        }
      }
    }

    // 2. File URIs from file manager — must read synchronously before any await
    const uriList = e.clipboardData?.getData("text/uri-list") ?? "";
    const uriPaths = parseUriList(uriList);

    // Handle image files from web clipboard API
    if (webImageFiles.length > 0) {
      e.preventDefault();
      await handleFiles(webImageFiles);
      return;
    }

    // Handle file URIs — preventDefault must be synchronous or browser pastes the text
    if (uriPaths.length > 0) {
      e.preventDefault();
      await handleDroppedPaths(uriPaths);
      return;
    }

    // 3. Fallback: read image from OS clipboard via navigator API then Tauri plugin.
    //    For clipboard images in a textarea the browser default does nothing, so
    //    the late e.preventDefault() call is still effective.
    const tauriImage = await readClipboardImage();
    if (tauriImage) {
      e.preventDefault();
      await handleFiles([tauriImage]);
      return;
    }

    // 4. Plain text — let the browser handle it naturally (no preventDefault)
  }

  async function initDragDrop(): Promise<() => void> {
    const { getCurrentWebviewWindow } =
      await import("@tauri-apps/api/webviewWindow");
    return getCurrentWebviewWindow().onDragDropEvent((event) => {
      if (event.payload.type === "enter" || event.payload.type === "over") {
        isDragging.value = true;
      } else if (event.payload.type === "leave") {
        isDragging.value = false;
      } else if (event.payload.type === "drop") {
        void handleDroppedPaths(event.payload.paths);
      }
    });
  }

  return {
    attachments,
    isDragging,
    handleFiles,
    removeAttachment,
    clearAttachments,
    handleDroppedPaths,
    onPaste,
    onGlobalPaste,
    initDragDrop,
  };
}
