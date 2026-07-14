import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relativeLuminance } from "./color";

/**
 * Contrast is checked against the real stylesheet, not against a copy of the
 * colors pasted into a test. A theme tweak that drops text below WCAG AA now
 * fails the build instead of quietly shipping, which is the whole point --
 * nobody notices low contrast until someone who needs it can't read the app.
 */
const css = readFileSync(
  fileURLToPath(new URL("./App.css", import.meta.url)),
  "utf-8",
);

/** Pull the custom properties out of one CSS block, e.g. `:root { ... }`. */
function vars(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!block) throw new Error(`no CSS block found for ${selector}`);

  const found: Record<string, string> = {};
  for (const [, name, value] of block[1].matchAll(
    /(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g,
  )) {
    found[name] = value;
  }
  return found;
}

/** WCAG 2.1 contrast ratio, 1:1 (identical) to 21:1 (black on white). */
function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const dark = vars(":root");
const light = { ...dark, ...vars('[data-theme="light"]') };
const darkHC = { ...dark, ...vars('[data-contrast="high"]') };
const lightHC = {
  ...light,
  ...vars('[data-contrast="high"]'),
  ...vars('[data-theme="light"][data-contrast="high"]'),
};

/** Text colors, and the backgrounds they actually sit on. */
const TEXT = ["--text-primary", "--text-secondary", "--text-dim", "--accent-text"];
const BACKGROUNDS = ["--bg-base", "--bg-panel"];

function check(
  themeName: string,
  theme: Record<string, string>,
  minimum: number,
) {
  for (const fg of TEXT) {
    for (const bg of BACKGROUNDS) {
      it(`${themeName}: ${fg} on ${bg} reaches ${minimum}:1`, () => {
        const ratio = contrast(theme[fg], theme[bg]);
        expect(
          ratio,
          `${theme[fg]} on ${theme[bg]} is only ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(minimum);
      });
    }
  }
}

describe("default themes meet WCAG AA (4.5:1)", () => {
  check("dark", dark, 4.5);
  check("light", light, 4.5);
});

describe("high contrast meets WCAG AAA (7:1)", () => {
  check("dark + high contrast", darkHC, 7);
  check("light + high contrast", lightHC, 7);
});

describe("white-on-accent surfaces", () => {
  // --accent-dim is a button and status-bar fill with white text on it.
  for (const [name, theme] of [
    ["dark", dark],
    ["light", light],
  ] as const) {
    it(`${name}: white text on --accent-dim reaches AA`, () => {
      expect(contrast("#ffffff", theme["--accent-dim"])).toBeGreaterThanOrEqual(
        4.5,
      );
    });
  }
});

describe("the stylesheet doesn't suppress focus rings", () => {
  // Comments stripped: a rule matters, a sentence about one doesn't.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("has no `outline: none`", () => {
    // A keyboard user has to be able to see where they are.
    expect(rules).not.toMatch(/outline:\s*none/);
  });

  it("defines a :focus-visible ring", () => {
    expect(rules).toMatch(/:focus-visible\s*\{[^}]*outline:/);
  });
});
