import { type Ref } from "vue";

// WebKitGTK on Wayland doesn't route Ctrl+Z to the textarea's native undo stack,
// and execCommand("undo") conflicts with Vue's v-model. Operates directly on the
// caller's Ref<string> so no value-sync gymnastics are needed at the call site.
export function useUndoHistory(target: Ref<string>) {
  const undoStack: string[] = [target.value];
  const redoStack: string[] = [];
  let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

  function saveSnapshot() {
    const v = target.value;
    if (v !== undoStack[undoStack.length - 1]) {
      undoStack.push(v);
      redoStack.length = 0;
      if (undoStack.length > 100) undoStack.shift();
    }
  }

  function scheduleSnapshot() {
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(saveSnapshot, 300);
  }

  function undo() {
    saveSnapshot();
    if (undoStack.length <= 1) return;
    redoStack.push(undoStack.pop()!);
    target.value = undoStack[undoStack.length - 1];
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop()!;
    undoStack.push(next);
    target.value = next;
  }

  return { saveSnapshot, scheduleSnapshot, undo, redo };
}
