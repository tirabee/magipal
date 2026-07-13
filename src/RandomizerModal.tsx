import { useState, useCallback, useEffect } from "react";
import type { Palette } from "./storage";
import { DestinationPicker } from "./DestinationPicker";
import type { Destination } from "./DestinationPicker";
import { generatePalette, HARMONY_SCHEMES } from "./color";
import type { HarmonyScheme } from "./color";

const SCHEME_LABELS: Record<HarmonyScheme, string> = {
  monochrome: "Monochrome — one hue, shade to tint",
  analogous: "Analogous — neighbours on the wheel",
  complementary: "Complementary — opposite hues",
  triadic: "Triadic — three evenly spaced hues",
  tetradic: "Tetradic — four evenly spaced hues",
};

export function RandomizerModal({
  palettes,
  currentPaletteId,
  onImport,
  onClose,
}: {
  palettes: Palette[];
  currentPaletteId: string | null;
  onImport: (colors: string[], destination: Destination, newName?: string) => void;
  onClose: () => void;
}) {
  const [scheme, setScheme] = useState<HarmonyScheme>("analogous");
  const [count, setCount] = useState(6);
  const [colors, setColors] = useState<string[]>([]);
  const [destination, setDestination] = useState<Destination>(
    currentPaletteId ?? "new",
  );
  const [newName, setNewName] = useState("Random Palette");

  const reroll = useCallback(() => {
    setColors(generatePalette({ count, scheme }));
  }, [count, scheme]);

  // Regenerate whenever the knobs change, so the preview always matches them.
  useEffect(() => {
    reroll();
  }, [reroll]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">Randomize Palette</span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="tab-content">
          <div className="randomizer-preview">
            {colors.map((hex, i) => (
              <div
                key={i}
                className="randomizer-chip"
                style={{ background: hex }}
                title={hex}
              />
            ))}
          </div>

          <div className="randomizer-controls">
            <label className="input-modal-field">
              <span className="input-modal-label">Harmony</span>
              <select
                className="sort-select"
                value={scheme}
                onChange={(e) => setScheme(e.target.value as HarmonyScheme)}
              >
                {(Object.keys(HARMONY_SCHEMES) as HarmonyScheme[]).map((s) => (
                  <option key={s} value={s}>
                    {SCHEME_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>

            <label className="input-modal-field">
              <span className="input-modal-label">Colors: {count}</span>
              <input
                type="range"
                min={2}
                max={16}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </label>
          </div>

          <button className="btn btn-accent randomizer-reroll" onClick={reroll}>
            🎲 Reroll
          </button>

          <DestinationPicker
            name="random-dest"
            palettes={palettes}
            currentPaletteId={currentPaletteId}
            value={destination}
            onChange={setDestination}
          />

          {destination === "new" && (
            <div className="input-modal-field">
              <label className="input-modal-label">New palette name</label>
              <input
                className="text-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
          )}

          <div className="picker-actions">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-accent"
              onClick={() =>
                onImport(
                  colors,
                  destination,
                  destination === "new" ? newName : undefined,
                )
              }
              disabled={colors.length === 0}
            >
              Add {colors.length} colors
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
