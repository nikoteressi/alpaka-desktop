import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { useUndoHistory } from "./useUndoHistory";

describe("useUndoHistory", () => {
  describe("initial state", () => {
    it("target ref retains its initial value", () => {
      const target = ref("hello");
      useUndoHistory(target);
      expect(target.value).toBe("hello");
    });

    it("undo at initial state does nothing", () => {
      const target = ref("hello");
      const { undo } = useUndoHistory(target);
      undo();
      expect(target.value).toBe("hello");
    });

    it("redo when redoStack is empty does nothing", () => {
      const target = ref("hello");
      const { redo } = useUndoHistory(target);
      redo();
      expect(target.value).toBe("hello");
    });
  });

  describe("saveSnapshot", () => {
    it("pushes a new value onto the undoStack", () => {
      const target = ref("a");
      const { saveSnapshot, undo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      undo();
      expect(target.value).toBe("a");
    });

    it("deduplicates — calling saveSnapshot twice with same value does not add duplicate entry", () => {
      const target = ref("a");
      const { saveSnapshot, undo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      saveSnapshot(); // same value again
      undo();
      // should be back at "a", not at "b" (duplicate entry would mean two undos needed)
      expect(target.value).toBe("a");
    });

    it("clears the redoStack when a new snapshot is saved after undo", () => {
      const target = ref("a");
      const { saveSnapshot, undo, redo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      undo(); // target -> "a", "b" in redoStack
      // user types something new
      target.value = "c";
      saveSnapshot(); // should clear redoStack
      redo(); // should be no-op
      expect(target.value).toBe("c");
    });
  });

  describe("undo", () => {
    it("moves target to the previous value", () => {
      const target = ref("a");
      const { saveSnapshot, undo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      undo();
      expect(target.value).toBe("a");
    });

    it("handles multiple successive undos", () => {
      const target = ref("a");
      const { saveSnapshot, undo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      target.value = "c";
      saveSnapshot();
      undo();
      expect(target.value).toBe("b");
      undo();
      expect(target.value).toBe("a");
    });

    it("does not go below the initial state", () => {
      const target = ref("a");
      const { saveSnapshot, undo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      undo();
      undo(); // at bottom of stack
      undo(); // should still be "a"
      expect(target.value).toBe("a");
    });

    it("calls saveSnapshot internally (commits any pending unsaved change before undoing)", () => {
      const target = ref("a");
      const { saveSnapshot, undo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      // change target without calling saveSnapshot
      target.value = "c";
      undo(); // should snapshot "c", then undo to "b"
      expect(target.value).toBe("b");
    });
  });

  describe("redo", () => {
    it("restores value after undo", () => {
      const target = ref("a");
      const { saveSnapshot, undo, redo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      undo();
      expect(target.value).toBe("a");
      redo();
      expect(target.value).toBe("b");
    });

    it("supports multiple successive redos", () => {
      const target = ref("a");
      const { saveSnapshot, undo, redo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      target.value = "c";
      saveSnapshot();
      undo();
      undo();
      redo();
      expect(target.value).toBe("b");
      redo();
      expect(target.value).toBe("c");
    });

    it("does nothing when redoStack is empty after a new snapshot was saved", () => {
      const target = ref("a");
      const { saveSnapshot, undo, redo } = useUndoHistory(target);
      target.value = "b";
      saveSnapshot();
      undo();
      target.value = "c";
      saveSnapshot(); // clears redoStack
      redo();
      expect(target.value).toBe("c");
    });
  });

  describe("stack cap", () => {
    it("keeps undoStack at most 100 entries after 101 unique values", () => {
      const target = ref("0");
      const { saveSnapshot, undo } = useUndoHistory(target);
      // Push 100 more snapshots (total 101 including initial "0")
      for (let i = 1; i <= 100; i++) {
        target.value = String(i);
        saveSnapshot();
      }
      // undoStack should have been capped: earliest entry ("0") was shifted out
      // Undoing 100 times should reach "1", not "0"
      for (let i = 0; i < 99; i++) undo();
      expect(target.value).toBe("1");
      // one more undo should be a no-op (we're at the bottom of the 100-entry stack)
      undo();
      expect(target.value).toBe("1");
    });
  });

  describe("scheduleSnapshot (timer)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not save snapshot immediately", () => {
      const target = ref("a");
      const { scheduleSnapshot, undo } = useUndoHistory(target);
      target.value = "b";
      scheduleSnapshot();
      // timer has not fired yet
      undo(); // saveSnapshot captures "b" internally, then pops it
      // with no snapshot saved by timer, "b" was the only unsaved change —
      // after undo we expect "a"
      expect(target.value).toBe("a");
    });

    it("saves snapshot after 300 ms and makes value undoable", () => {
      const target = ref("a");
      const { scheduleSnapshot, undo } = useUndoHistory(target);
      target.value = "b";
      scheduleSnapshot();
      vi.advanceTimersByTime(300);
      // Timer fired → saveSnapshot committed "b"
      // Now change target again without snapshot
      target.value = "c";
      // undo: snapshots "c" then undoes to "b"
      undo();
      expect(target.value).toBe("b");
    });

    it("debounces — a second schedule within 300 ms resets the timer", () => {
      const target = ref("a");
      const { scheduleSnapshot, undo } = useUndoHistory(target);
      target.value = "b";
      scheduleSnapshot();
      vi.advanceTimersByTime(150);
      target.value = "bc";
      scheduleSnapshot(); // resets timer; "b" snapshot never fires
      vi.advanceTimersByTime(150); // total 300ms from first, but only 150ms from second
      // Timer has NOT fired for second call yet
      // undo snapshots "bc" and undoes to "a" (no intermediate "b" in stack)
      undo();
      expect(target.value).toBe("a");
    });
  });
});
