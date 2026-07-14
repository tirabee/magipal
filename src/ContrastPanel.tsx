import { useState } from "react";
import type { Color } from "./storage";
import { contrastRatio, wcagLevel, WCAG } from "./color";
import type { WcagLevel } from "./color";

const LEVEL_CLASS: Record<WcagLevel, string> = {
  AAA: "contrast-aaa",
  AA: "contrast-aa",
  "AA Large": "contrast-aa-large",
  Fail: "contrast-fail",
};

export function ContrastPanel({ colors }: { colors: Color[] }) {
  const [selected, setSelected] = useState<{ fg: number; bg: number } | null>(
    null,
  );

  const hexes = colors.map((c) => c.hex);

  if (hexes.length < 2) {
    return (
      <div className="empty-state" style={{ height: "auto", paddingTop: 40 }}>
        <div className="empty-state-text">
          add at least two colors to compare their contrast
        </div>
      </div>
    );
  }

  // Every unordered pair, counted once. Contrast is symmetric, so #fff on #000
  // and #000 on #fff are the same ratio -- reporting both would double-count.
  let readablePairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      totalPairs++;
      if (contrastRatio(hexes[i], hexes[j]) >= WCAG.aa) readablePairs++;
    }
  }

  const pair = selected
    ? {
        fg: hexes[selected.fg],
        bg: hexes[selected.bg],
        ratio: contrastRatio(hexes[selected.fg], hexes[selected.bg]),
      }
    : null;

  return (
    <div className="contrast-panel">
      <div className="contrast-summary">
        <strong>{readablePairs}</strong> of {totalPairs} color pairs are readable
        as body text (WCAG AA, 4.5:1).
      </div>

      <div className="contrast-grid-wrap">
        <table className="contrast-grid">
          <thead>
            <tr>
              <th className="contrast-corner">
                <span className="contrast-corner-fg">text ↓</span>
                <span className="contrast-corner-bg">on bg →</span>
              </th>
              {hexes.map((bg, i) => (
                <th key={i} className="contrast-head">
                  <span
                    className="contrast-head-chip"
                    style={{ background: bg }}
                    title={bg}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hexes.map((fg, row) => (
              <tr key={row}>
                <th className="contrast-head">
                  <span
                    className="contrast-head-chip"
                    style={{ background: fg }}
                    title={fg}
                  />
                </th>
                {hexes.map((bg, col) => {
                  if (row === col) {
                    return (
                      <td key={col} className="contrast-cell contrast-same">
                        –
                      </td>
                    );
                  }
                  const ratio = contrastRatio(fg, bg);
                  const level = wcagLevel(ratio);
                  const isSelected =
                    selected?.fg === row && selected?.bg === col;
                  return (
                    <td
                      key={col}
                      // The cell IS the demo: it's drawn in the very colors it's
                      // reporting on, so if you can't read the number, it failed.
                      className={`contrast-cell ${LEVEL_CLASS[level]} ${
                        isSelected ? "contrast-cell-selected" : ""
                      }`}
                      style={{ background: bg, color: fg }}
                      onClick={() => setSelected({ fg: row, bg: col })}
                      title={`${fg} on ${bg} — ${ratio.toFixed(2)}:1 (${level})`}
                    >
                      {ratio.toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="contrast-legend">
        <span className="contrast-key contrast-aaa">AAA ≥ 7</span>
        <span className="contrast-key contrast-aa">AA ≥ 4.5</span>
        <span className="contrast-key contrast-aa-large">Large only ≥ 3</span>
        <span className="contrast-key contrast-fail">Fail &lt; 3</span>
      </div>

      {pair && (
        <div className="contrast-preview" style={{ background: pair.bg }}>
          <div className="contrast-preview-big" style={{ color: pair.fg }}>
            Large heading text
          </div>
          <div className="contrast-preview-body" style={{ color: pair.fg }}>
            Body text at the size you'd actually read. If this is hard to make
            out, the number is telling you why.
          </div>
          <div className="contrast-preview-meta" style={{ color: pair.fg }}>
            {pair.fg} on {pair.bg} — {pair.ratio.toFixed(2)}:1 ·{" "}
            {wcagLevel(pair.ratio)}
            {pair.ratio < WCAG.ui &&
              " · too low even for icons and borders (3:1)"}
          </div>
        </div>
      )}
    </div>
  );
}
