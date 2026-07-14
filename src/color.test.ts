import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  hexToHsl,
  hslToHex,
  rgbToHsv,
  hsvToRgb,
  isValidHex,
  relativeLuminance,
  generatePalette,
  HARMONY_SCHEMES,
  simulateColorVision,
  colorDistance,
  findConfusablePairs,
  CONFUSABLE_THRESHOLD,
  contrastRatio,
  wcagLevel,
} from "./color";
import type { HarmonyScheme } from "./color";

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#c47a6f")).toEqual([196, 122, 111]);
  });

  it("expands 3-digit shorthand", () => {
    // The dither view's old copy sliced characters positionally and returned
    // NaN here; every caller happened to pre-expand, so it never showed.
    expect(hexToRgb("#f00")).toEqual([255, 0, 0]);
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
  });

  it("does not require a leading #", () => {
    expect(hexToRgb("00ff00")).toEqual([0, 255, 0]);
  });
});

describe("rgbToHex", () => {
  it("pads single-digit channels", () => {
    expect(rgbToHex(0, 8, 16)).toBe("#000810");
  });

  it("clamps out-of-range channels instead of emitting malformed hex", () => {
    expect(rgbToHex(300, -20, 128)).toBe("#ff0080");
  });

  it("rounds fractional channels", () => {
    expect(rgbToHex(0.6, 127.5, 254.4)).toBe("#0180fe");
  });
});

describe("hsl round-trip", () => {
  it("survives a round-trip through hsl", () => {
    for (const hex of ["#c47a6f", "#16213e", "#00ff00", "#123456"]) {
      expect(hslToHex(...hexToHsl(hex))).toBe(hex);
    }
  });

  it("handles greys, where hue is undefined", () => {
    expect(hslToHex(...hexToHsl("#808080"))).toBe("#808080");
    expect(hexToHsl("#808080")[1]).toBe(0); // no saturation
  });

  it("wraps hue rather than clipping it", () => {
    expect(hslToHex(360 + 120, 100, 50)).toBe(hslToHex(120, 100, 50));
    expect(hslToHex(-120, 100, 50)).toBe(hslToHex(240, 100, 50));
  });
});

describe("hsv round-trip", () => {
  it("survives a round-trip through hsv", () => {
    for (const hex of ["#c47a6f", "#16213e", "#ff0000"]) {
      const [r, g, b] = hexToRgb(hex);
      expect(rgbToHex(...hsvToRgb(...rgbToHsv(r, g, b)))).toBe(hex);
    }
  });
});

describe("isValidHex", () => {
  it("accepts 3- and 6-digit, with or without #", () => {
    for (const hex of ["#fff", "fff", "#ffffff", "ffffff"]) {
      expect(isValidHex(hex)).toBe(true);
    }
  });

  it("rejects wrong lengths and non-hex characters", () => {
    for (const hex of ["#ff", "#fffff", "#gggggg", "", "#"]) {
      expect(isValidHex(hex)).toBe(false);
    }
  });
});

describe("generatePalette", () => {
  const schemes = Object.keys(HARMONY_SCHEMES) as HarmonyScheme[];

  it("returns exactly the requested number of valid colors", () => {
    for (const scheme of schemes) {
      for (const count of [1, 4, 8, 16]) {
        const palette = generatePalette({ count, scheme, random: () => 0.5 });
        expect(palette).toHaveLength(count);
        for (const hex of palette) {
          expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });

  it("is deterministic given a fixed random source", () => {
    const args = { count: 6, scheme: "triadic" as const, random: () => 0.42 };
    expect(generatePalette(args)).toEqual(generatePalette(args));
  });

  it("varies when the random source varies", () => {
    const a = generatePalette({ count: 6, scheme: "triadic", random: () => 0.1 });
    const b = generatePalette({ count: 6, scheme: "triadic", random: () => 0.9 });
    expect(a).not.toEqual(b);
  });

  it("ramps from dark to light so it is usable as a shading ramp", () => {
    const palette = generatePalette({
      count: 6,
      scheme: "analogous",
      baseHue: 200,
      random: () => 0.5,
    });
    const lightnesses = palette.map((hex) => hexToHsl(hex)[2]);
    for (let i = 1; i < lightnesses.length; i++) {
      expect(lightnesses[i]).toBeGreaterThan(lightnesses[i - 1]);
    }
  });

  it("keeps a monochrome palette on a single hue", () => {
    const palette = generatePalette({
      count: 5,
      scheme: "monochrome",
      baseHue: 200,
      random: () => 0.5, // jitter is a constant 0, so hues land exactly
    });
    for (const hex of palette) {
      expect(hexToHsl(hex)[0]).toBeCloseTo(200, 0);
    }
  });

  it("puts complementary colors opposite each other on the wheel", () => {
    const [first, second] = generatePalette({
      count: 2,
      scheme: "complementary",
      baseHue: 30,
      random: () => 0.5,
    });
    const apart = Math.abs(hexToHsl(first)[0] - hexToHsl(second)[0]);
    expect(apart).toBeCloseTo(180, 0);
  });
});

describe("simulateColorVision", () => {
  it("leaves greys alone — achromatic colors look the same to everyone", () => {
    for (const vision of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      for (const grey of ["#000000", "#808080", "#ffffff"]) {
        const [r, g, b] = hexToRgb(simulateColorVision(grey, vision));
        // still grey: all three channels within a rounding step of each other
        expect(Math.abs(r - g)).toBeLessThanOrEqual(2);
        expect(Math.abs(g - b)).toBeLessThanOrEqual(2);
      }
    }
  });

  it("collapses red and green together for protanopia and deuteranopia", () => {
    const apart = colorDistance("#ff0000", "#00ff00");
    for (const vision of ["protanopia", "deuteranopia"] as const) {
      const seen = colorDistance(
        simulateColorVision("#ff0000", vision),
        simulateColorVision("#00ff00", vision),
      );
      expect(seen).toBeLessThan(apart / 2);
    }
  });

  it("keeps red and green distinguishable for tritanopia", () => {
    // Tritanopia is a blue/yellow deficiency; red vs green survives it.
    const seen = colorDistance(
      simulateColorVision("#ff0000", "tritanopia"),
      simulateColorVision("#00ff00", "tritanopia"),
    );
    expect(seen).toBeGreaterThan(CONFUSABLE_THRESHOLD);
  });

  it("always returns a valid hex", () => {
    for (const vision of ["protanopia", "deuteranopia", "tritanopia"] as const) {
      for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#c47a6f", "#123456"]) {
        expect(simulateColorVision(hex, vision)).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("findConfusablePairs", () => {
  // A red and a green that a deuteranope genuinely cannot separate: both land
  // on the same olive once the red-green axis collapses. 291 apart to full
  // color vision, 25 apart to a deuteranope.
  const TRAP_RED = "#cc3e3e";
  const TRAP_GREEN = "#3e9a3e";

  it("flags a genuinely confusable red/green pair for deuteranopia", () => {
    const pairs = findConfusablePairs([TRAP_RED, TRAP_GREEN], "deuteranopia");
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: 0, b: 1 });
  });

  it("does not flag pure red vs pure green", () => {
    // They collapse to the same hue but stay far apart in brightness, so a
    // deuteranope still tells them apart. Flagging them would be a false alarm.
    expect(findConfusablePairs(["#ff0000", "#00ff00"], "deuteranopia")).toEqual(
      [],
    );
  });

  it("does not flag colors that stay distinct", () => {
    // Blue vs yellow survives deuteranopia fine.
    expect(findConfusablePairs(["#0000ff", "#ffff00"], "deuteranopia")).toEqual(
      [],
    );
  });

  it("ignores pairs that are already near-identical to everyone", () => {
    // That's a duplicate, not an accessibility problem.
    expect(findConfusablePairs(["#ff0000", "#fe0101"], "deuteranopia")).toEqual(
      [],
    );
  });

  it("sorts the worst offenders first", () => {
    const pairs = findConfusablePairs(
      [TRAP_RED, TRAP_GREEN, "#0000ff", "#c85050", "#4f9b4f"],
      "deuteranopia",
    );
    expect(pairs.length).toBeGreaterThan(1);
    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i].distance).toBeGreaterThanOrEqual(pairs[i - 1].distance);
    }
  });
});

describe("contrastRatio", () => {
  it("anchors black-on-white at the maximum 21:1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("gives 1:1 for a color against itself", () => {
    expect(contrastRatio("#c47a6f", "#c47a6f")).toBeCloseTo(1, 5);
  });

  it("is symmetric — argument order doesn't matter", () => {
    expect(contrastRatio("#1a1a2e", "#e8e8f0")).toBeCloseTo(
      contrastRatio("#e8e8f0", "#1a1a2e"),
      5,
    );
  });

  it("matches a known published value", () => {
    // #767676 on white is the canonical "exactly passes AA" grey.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
  });
});

describe("wcagLevel", () => {
  it("maps ratios to the right band", () => {
    expect(wcagLevel(21)).toBe("AAA");
    expect(wcagLevel(7)).toBe("AAA");
    expect(wcagLevel(6.99)).toBe("AA");
    expect(wcagLevel(4.5)).toBe("AA");
    expect(wcagLevel(4.49)).toBe("AA Large");
    expect(wcagLevel(3)).toBe("AA Large");
    expect(wcagLevel(2.99)).toBe("Fail");
    expect(wcagLevel(1)).toBe("Fail");
  });
});

describe("relativeLuminance", () => {
  it("anchors black at 0 and white at 1", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("linearizes before weighting", () => {
    // Mid-grey looks about 21.6% as bright as white, not 50%. The old
    // un-linearized version returned ~0.502 here, which is what would have made
    // a WCAG contrast checker quietly wrong.
    expect(relativeLuminance("#808080")).toBeCloseTo(0.2158, 3);
  });

  it("ranks pure channels by perceived brightness: green > red > blue", () => {
    const red = relativeLuminance("#ff0000");
    const green = relativeLuminance("#00ff00");
    const blue = relativeLuminance("#0000ff");
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});
