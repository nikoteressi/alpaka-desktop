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
const TEXT_EXTS = new Set([
  ".txt",
  ".md",
  ".py",
  ".rs",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".html",
  ".css",
  ".sh",
  ".csv",
  ".xml",
  ".go",
  ".java",
  ".c",
  ".cpp",
  ".h",
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

function isFocusedOnEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function parseUriList(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .filter((line) => line.startsWith("file://"))
    .map((line) => decodeURIComponent(line.slice("file://".length)));
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
        } else if (TEXT_EXTS.has(ext)) {
          if (options.onLinkFile) {
            await options.onLinkFile(path);
          }
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
    if (isFocusedOnEditable(e.target)) return;

    const clipboardData = e.clipboardData;
    if (!clipboardData) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await handleFiles(imageFiles);
      return;
    }

    const uriList = clipboardData.getData("text/uri-list");
    if (uriList) {
      const paths = parseUriList(uriList);
      if (paths.length > 0) {
        e.preventDefault();
        await handleDroppedPaths(paths);
        return;
      }
    }
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
