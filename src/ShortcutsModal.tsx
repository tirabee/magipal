/** The single source of truth for what's bound — the help list can't drift. */
export const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["Ctrl", "Z"], description: "Undo" },
  { keys: ["Ctrl", "Shift", "Z"], description: "Redo" },
  { keys: ["Ctrl", "N"], description: "New palette" },
  { keys: ["Ctrl", "Shift", "N"], description: "New folder" },
  { keys: ["Ctrl", "I"], description: "Import hex codes" },
  { keys: ["Ctrl", "R"], description: "Randomize a palette" },
  { keys: ["Ctrl", "E"], description: "Export the current palette" },
  { keys: ["Ctrl", "L"], description: "Lock / unlock the current palette" },
  { keys: ["Ctrl", "D"], description: "Toggle the dither view" },
  { keys: ["Ctrl", "B"], description: "Toggle the color blindness view" },
  { keys: ["↑", "↓"], description: "Select the previous / next palette" },
  { keys: ["Esc"], description: "Close the open dialog" },
  { keys: ["?"], description: "Show this list" },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">Keyboard Shortcuts</span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="tab-content">
          <div className="shortcut-list">
            {SHORTCUTS.map(({ keys, description }) => (
              <div key={description} className="shortcut-row">
                <span className="shortcut-keys">
                  {keys.map((k) => (
                    <kbd key={k} className="shortcut-key">
                      {k}
                    </kbd>
                  ))}
                </span>
                <span className="shortcut-description">{description}</span>
              </div>
            ))}
          </div>
          <div className="tab-description">
            Shortcuts are ignored while you&rsquo;re typing in a text field.
          </div>
        </div>
      </div>
    </div>
  );
}
