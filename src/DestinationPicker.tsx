import type { Palette } from "./storage";

/** Either a brand-new palette, or the id of an existing one. */
export type Destination = "new" | string;

/**
 * The "Add colors to:" list shared by every import modal. It lived as
 * copy-pasted markup in each of them, which is how the lock check ended up
 * present in one import path and missing from four.
 *
 * Locked palettes are shown but disabled: hiding them would leave the user
 * wondering where their palette went.
 */
export function DestinationPicker({
  palettes,
  currentPaletteId,
  value,
  onChange,
  name,
  label = "Add colors to:",
}: {
  palettes: Palette[];
  currentPaletteId: string | null;
  value: Destination;
  onChange: (destination: Destination) => void;
  /** Radio-group name; must be unique per modal on screen. */
  name: string;
  label?: string;
}) {
  const current = palettes.find((p) => p.id === currentPaletteId) ?? null;
  const others = palettes.filter((p) => p.id !== currentPaletteId);

  const option = (id: Destination, text: string, locked = false) => (
    <label
      key={id}
      className={`destination-option ${locked ? "destination-option-locked" : ""}`}
      title={locked ? "Locked — unlock this palette to add colors" : undefined}
    >
      <input
        type="radio"
        name={name}
        value={id}
        checked={value === id}
        disabled={locked}
        onChange={() => onChange(id)}
      />
      <span>
        {locked && "🔒 "}
        {text}
      </span>
    </label>
  );

  return (
    <div className="destination-picker">
      <div className="destination-label">{label}</div>
      <div className="destination-options">
        {option("new", "New palette")}
        {current && option(current.id, "Current palette", !!current.locked)}
        {others.map((p) => option(p.id, p.name, !!p.locked))}
      </div>
    </div>
  );
}
