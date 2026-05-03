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
          const { invoke } = await import("@tauri-apps/api/core");
          const name = path.split("/").pop() ?? "image";
          let rawBytes: number[];
          try {
            rawBytes = await invoke<number[]>("read_image_file", { path });
          } catch (e) {
            console.warn(`Dropped image ${name} could not be read: ${e}`);
            return;
          }
          const bytes = new Uint8Array(rawBytes);
          const file = new File([bytes], name, { type: mimeFromExt(ext) });
          const previewUrl = URL.createObjectURL(file);
          attachments.value.push({ file, previewUrl, data: bytes });
        } else if (options.onLinkFile) {
          await options.onLinkFile(path);
        }
      }),
    );
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
    initDragDrop,
  };
}
