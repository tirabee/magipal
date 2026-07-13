import type { Color } from "./storage";
import {
  simulateColorVision,
  findConfusablePairs,
  COLOR_VISION_LABELS,
} from "./color";
import type { ColorVision } from "./color";

const VISIONS: ColorVision[] = ["protanopia", "deuteranopia", "tritanopia"];

function Row({
  label,
  colors,
  hint,
}: {
  label: string;
  colors: string[];
  hint?: string;
}) {
  return (
    <div className="vision-row">
      <div className="vision-row-label">
        {label}
        {hint && <span className="vision-row-hint">{hint}</span>}
      </div>
      <div className="vision-strip">
        {colors.map((hex, i) => (
          <div
            key={i}
            className="vision-chip"
            style={{ background: hex }}
            title={hex}
          />
        ))}
      </div>
    </div>
  );
}

export function ColorVisionPanel({ colors }: { colors: Color[] }) {
  const hexes = colors.map((c) => c.hex);

  if (hexes.length === 0) {
    return (
      <div className="empty-state" style={{ height: "auto", paddingTop: 40 }}>
        <div className="empty-state-text">
          add some colors to check them for color blindness
        </div>
      </div>
    );
  }

  const problems = VISIONS.map((vision) => ({
    vision,
    pairs: findConfusablePairs(hexes, vision),
  })).filter((p) => p.pairs.length > 0);

  return (
    <div className="vision-panel">
      <Row label="Normal vision" colors={hexes} />
      {VISIONS.map((vision) => (
        <Row
          key={vision}
          label={COLOR_VISION_LABELS[vision]}
          colors={hexes.map((hex) => simulateColorVision(hex, vision))}
        />
      ))}

      <div className="vision-report">
        {problems.length === 0 ? (
          <div className="vision-report-ok">
            ✓ No two colors in this palette become indistinguishable under any
            of the three simulations.
          </div>
        ) : (
          problems.map(({ vision, pairs }) => (
            <div key={vision} className="vision-report-group">
              <div className="vision-report-title">
                ⚠ {COLOR_VISION_LABELS[vision]} —{" "}
                {pairs.length === 1
                  ? "1 confusable pair"
                  : `${pairs.length} confusable pairs`}
              </div>
              {pairs.map(({ a, b }) => (
                <div key={`${a}-${b}`} className="vision-report-pair">
                  <span
                    className="vision-pair-chip"
                    style={{ background: hexes[a] }}
                  />
                  <code>{hexes[a]}</code>
                  <span className="vision-pair-vs">and</span>
                  <span
                    className="vision-pair-chip"
                    style={{ background: hexes[b] }}
                  />
                  <code>{hexes[b]}</code>
                  <span className="vision-pair-arrow">→ both look like</span>
                  <span
                    className="vision-pair-chip"
                    style={{ background: simulateColorVision(hexes[a], vision) }}
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
