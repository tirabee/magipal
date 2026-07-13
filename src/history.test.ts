import { describe, it, expect } from "vitest";
import {
  emptyHistory,
  record,
  undo,
  redo,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
  HISTORY_LIMIT,
} from "./history";
import type { History, Snapshot } from "./history";
import type { AppData } from "./storage";

/** A distinguishable AppData, tagged by folder name so states are comparable. */
function state(tag: string): AppData {
  return { palettes: [], folders: [tag] };
}

function snap(tag: string, label: string, selectedId: string | null = null): Snapshot {
  return { data: state(tag), selectedId, label };
}

/** Applies a mutation the way App does: record where we were, then move on. */
function apply(history: History, from: Snapshot): History {
  return record(history, from);
}

describe("record", () => {
  it("starts with nothing to undo or redo", () => {
    expect(canUndo(emptyHistory)).toBe(false);
    expect(canRedo(emptyHistory)).toBe(false);
    expect(undoLabel(emptyHistory)).toBeNull();
  });

  it("makes the recorded action undoable, by name", () => {
    const h = record(emptyHistory, snap("a", "add color"));
    expect(canUndo(h)).toBe(true);
    expect(undoLabel(h)).toBe("add color");
  });

  it("caps the history, dropping the oldest states", () => {
    let h = emptyHistory;
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      h = record(h, snap(`s${i}`, `action ${i}`));
    }
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    // The oldest survivor is the 20th action, not the 0th.
    expect(h.past[0].label).toBe("action 20");
  });
});

describe("undo / redo", () => {
  it("returns null when there is nothing to undo", () => {
    expect(undo(emptyHistory, { data: state("now"), selectedId: null })).toBeNull();
  });

  it("restores the previous state and makes it redoable", () => {
    const h = record(emptyHistory, snap("before", "add color"));

    const undone = undo(h, { data: state("after"), selectedId: null })!;
    expect(undone.restore.data).toEqual(state("before"));
    expect(canUndo(undone.history)).toBe(false);
    expect(canRedo(undone.history)).toBe(true);
    // The redo is named for the action it replays.
    expect(redoLabel(undone.history)).toBe("add color");

    const redone = redo(undone.history, { data: state("before"), selectedId: null })!;
    expect(redone.restore.data).toEqual(state("after"));
    expect(canRedo(redone.history)).toBe(false);
    expect(undoLabel(redone.history)).toBe("add color");
  });

  it("restores the selection that was active at the time", () => {
    const h = record(emptyHistory, snap("before", "delete palette", "palette-1"));
    const undone = undo(h, { data: state("after"), selectedId: "palette-2" })!;
    expect(undone.restore.selectedId).toBe("palette-1");
  });

  it("walks back and forward through several steps in order", () => {
    let h = emptyHistory;
    h = apply(h, snap("s0", "first"));
    h = apply(h, snap("s1", "second"));
    h = apply(h, snap("s2", "third"));

    // We are now at s3. Undo three times.
    const seen: string[] = [];
    let current: Omit<Snapshot, "label"> = {
      data: state("s3"),
      selectedId: null,
    };
    for (let i = 0; i < 3; i++) {
      const step = undo(h, current)!;
      h = step.history;
      current = { data: step.restore.data, selectedId: step.restore.selectedId };
      seen.push(step.restore.data.folders[0]);
    }
    expect(seen).toEqual(["s2", "s1", "s0"]);
    expect(canUndo(h)).toBe(false);

    // And forward again.
    const forward: string[] = [];
    for (let i = 0; i < 3; i++) {
      const step = redo(h, current)!;
      h = step.history;
      current = { data: step.restore.data, selectedId: step.restore.selectedId };
      forward.push(step.restore.data.folders[0]);
    }
    expect(forward).toEqual(["s1", "s2", "s3"]);
    expect(canRedo(h)).toBe(false);
  });

  it("abandons the redo branch when a new action happens", () => {
    // The classic undo bug: undo twice, do something new, then redo -- and get
    // teleported into a timeline that no longer exists.
    let h = record(emptyHistory, snap("s0", "first"));
    h = record(h, snap("s1", "second"));

    const undone = undo(h, { data: state("s2"), selectedId: null })!;
    expect(canRedo(undone.history)).toBe(true);

    const afterNewAction = record(undone.history, snap("s1", "third"));
    expect(canRedo(afterNewAction)).toBe(false);
    expect(redoLabel(afterNewAction)).toBeNull();
  });
});
