import { ref } from "vue";

export interface Attachment {
  file: File;
  previewUrl: string;
  data: Uint8Array | null;
}

export function useAttachments() {
  const attachments = ref<Attachment[]>([]);
  const isDragging = ref(false);
  let dragCounter = 0;

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

  function onDragEnter(e: DragEvent) {
    if (e.dataTransfer?.types.includes("Files")) {
      dragCounter++;
      isDragging.value = true;
    }
  }

  function onDragLeave() {
    dragCounter--;
    if (dragCounter === 0) isDragging.value = false;
  }

  async function onDrop(e: DragEvent) {
    dragCounter = 0;
    isDragging.value = false;
    if (e.dataTransfer?.files) await handleFiles(e.dataTransfer.files);
  }

  async function onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await handleFiles(imageFiles);
    }
  }

  return {
    attachments,
    isDragging,
    handleFiles,
    removeAttachment,
    clearAttachments,
    onDragEnter,
    onDragLeave,
    onDrop,
    onPaste,
  };
}
