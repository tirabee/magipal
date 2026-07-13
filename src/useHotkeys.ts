import { useEffect, useRef } from "react";

export type HotkeyMap = Record<string, () => void>;

/**
 * Normalizes an event into a lookup key like "mod+shift+n" or "escape".
 * "mod" is Ctrl on Windows/Linux and Cmd on Mac, so bindings work on both.
 */
function comboOf(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("mod");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

/** Keys typed into a field belong to the field, not to the app. */
function isTypingInto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

/**
 * Binds global keyboard shortcuts.
 *
 * The handlers live in a ref rather than in the effect's dependencies, so the
 * listener is attached once for the life of the component instead of being torn
 * down and re-added on every render -- while still always calling the *current*
 * handler, never a stale closure over old state.
 */
export function useHotkeys(bindings: HotkeyMap) {
  const latest = useRef(bindings);
  latest.current = bindings;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const combo = comboOf(e);

      // Escape is the one key that still works from inside a text field, so a
      // modal can always be dismissed without reaching for the mouse.
      if (combo !== "escape" && isTypingInto(e.target)) return;

      const handler = latest.current[combo];
      if (!handler) return;

      // Essential, not decorative: this is a webview, so mod+r would reload the
      // app and mod+p would open a print dialog if we let them through.
      e.preventDefault();
      handler();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
