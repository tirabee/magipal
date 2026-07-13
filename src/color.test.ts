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
