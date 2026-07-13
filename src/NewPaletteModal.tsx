import { useState } from "react";

/** Common pixel-art palette sizes, offered as one-click presets. */
const PRESETS = [4, 8, 16, 32];

export function NewPaletteModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string, maxColors?: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [limited, setLimited] = useState(false);
  const [max, setMax] = useState("16");

  // A cap is only meaningful as a positive whole number; anything else means
  // "no cap" rather than a cap of zero, which would make the palette unusable.
  const parsedMax = Number.parseInt(max, 10);
  const maxIsValid = Number.isInteger(parsedMax) && parsedMax > 0;
  const canConfirm = name.trim() !== "" && (!limited || maxIsValid);

  const confirm = () => {
    if (!canConfirm) return;
    onConfirm(name.trim(), limited ? parsedMax : undefined);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-titlebar">
          <span className="modal-title">New Palette</span>
          <button className="modal-close" onClick={onCancel}>
            ×
          </button>
        </div>
        <div className="confirm-body">
          <div className="input-modal-field">
            <label className="input-modal-label">Palette name</label>
            <input
              className="text-input"
              value={name}
              placeholder="My Palette…"
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
                if (e.key === "Escape") onCancel();
              }}
            />
          </div>

          <div className="input-modal-field">
            <label className="destination-option">
              <input
                type="checkbox"
                checked={limited}
                onChange={(e) => setLimited(e.target.checked)}
              />
              <span>Limit the number of colors</span>
            </label>

            {limited && (
              <div className="color-limit-row">
                <input
                  className="text-input color-limit-input"
                  type="number"
                  min={1}
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirm();
                    if (e.key === "Escape") onCancel();
                  }}
                />
                <div className="color-limit-presets">
                  {PRESETS.map((n) => (
                    <button
                      key={n}
                      className={`btn ${parsedMax === n ? "btn-accent" : ""}`}
                      onClick={() => setMax(String(n))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {limited && (
              <div className="tab-description">
                The palette won&rsquo;t accept more than this many colors. You
                can&rsquo;t change it later.
              </div>
            )}
          </div>

          <div className="confirm-actions">
            <button className="btn" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="btn btn-accent"
              onClick={confirm}
              disabled={!canConfirm}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
