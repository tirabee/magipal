import type { AppData } from "./storage";

/**
 * A complete, known-good app state, plus the UI selection that went with it.
 *
 * We snapshot the whole AppData rather than recording each action's inverse.
 * The data is tiny (~18 KB for a large collection), and the correctness argument
 * is decisive: every snapshot is a state that already passed every invariant
 * when it was created, so restoring one cannot produce an invalid state. There
 * is no inverse-operation logic that can be subtly wrong -- because there is no
 * inverse-operation logic at all. Undo works for features not yet written.
 */
export interface Snapshot {
  data: AppData;
  selectedId: string | null;
  /** What the action was, for "Undo add color". */
  label: string;
}

export interface History {
  past: Snapshot[];
  future: Snapshot[];
}

export const HISTORY_LIMIT = 100;

export const emptyHistory: History = { past: [], future: [] };

/**
 * Record the state we're leaving behind, just before an action changes it.
 *
 * Performing a new action abandons the redo branch: once you've gone somewhere
 * new, the states you'd undone your way out of are no longer reachable.
 */
export function record(history: History, snapshot: Snapshot): History {
  return {
    past: [...history.past, snapshot].slice(-HISTORY_LIMIT),
    future: [],
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/** The action that undo would reverse, e.g. "add color". Null if none. */
export function undoLabel(history: History): string | null {
  return history.past[history.past.length - 1]?.label ?? null;
}

/** The action that redo would replay. Null if none. */
export function redoLabel(history: History): string | null {
  return history.future[0]?.label ?? null;
}

/**
 * Step back one state. `current` is where we are now, which becomes the state
 * redo returns to -- carrying the label of the action we're undoing, so the
 * button can read "Redo add color".
 */
export function undo(
  history: History,
  current: Omit<Snapshot, "label">,
): { history: History; restore: Snapshot } | null {
  const restore = history.past[history.past.length - 1];
  if (!restore) return null;

  return {
    history: {
      past: history.past.slice(0, -1),
      future: [{ ...current, label: restore.label }, ...history.future],
    },
    restore,
  };
}

/** Step forward one state, mirroring undo. */
export function redo(
  history: History,
  current: Omit<Snapshot, "label">,
): { history: History; restore: Snapshot } | null {
  const restore = history.future[0];
  if (!restore) return null;

  return {
    history: {
      past: [...history.past, { ...current, label: restore.label }].slice(
        -HISTORY_LIMIT,
      ),
      future: history.future.slice(1),
    },
    restore,
  };
}
