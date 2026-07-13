/**
 * Every color conversion in the app. These lived as six near-copies across five
 * components, and they had quietly drifted apart -- the dither view's hexToRgb
 * didn't understand 3-digit shorthand and produced NaN for "#f00".
 *
 * Note the two different scale conventions, kept as-is because each is used
 * consistently by its callers:
 *   HSV -- h 0..360, s 0..1,   v 0..1     (the color picker's canvas math)
 *   HSL -- h 0..360, s 0..100, l 0..100   (the ramp generator and sorting)
 */

export type RGB = [number, number, number];
export type HSV = [number, number, number];
export type HSL = [number, number, number];

/** Accepts 3- or 6-digit hex, with or without a leading '#'. */
export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex);
}

/** Expands 3-digit shorthand, so "#f00" and "#ff0000" agree. */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Clamps and rounds, so an out-of-range channel can't produce a malformed hex. */
export function rgbToHex(r: number, g: number, b: number): string {
  const channel = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function hsvToRgb(h: number, s: number, v: number): RGB {
  h = h / 360;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), s, v];
}

export function hexToHsl(hex: string): HSL {
  const [r255, g255, b255] = hexToRgb(hex);
  const r = r255 / 255,
    g = g255 / 255,
    b = b255 / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0,
    sat = 0;
  if (max !== min) {
    const d = max - min;
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        hue = ((b - r) / d + 2) / 6;
        break;
      case b:
        hue = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [hue * 360, sat * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const hh = h / 360;

  if (s === 0) {
    const v = l * 255;
    return rgbToHex(v, v, v);
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgbToHex(
    hue2rgb(p, q, hh + 1 / 3) * 255,
    hue2rgb(p, q, hh) * 255,
    hue2rgb(p, q, hh - 1 / 3) * 255,
  );
}

/** Hue offsets, in degrees, that define each classical color harmony. */
export const HARMONY_SCHEMES = {
  monochrome: [0],
  analogous: [-30, -15, 0, 15, 30],
  complementary: [0, 180],
  triadic: [0, 120, 240],
  tetradic: [0, 90, 180, 270],
} as const;

export type HarmonyScheme = keyof typeof HARMONY_SCHEMES;

/**
 * Builds a harmonically-related palette rather than random noise: hues come
 * from one scheme around a base hue, and lightness is spread evenly so the
 * result reads as a usable ramp from shadow to highlight.
 *
 * `random` is injectable so the generator can be tested deterministically --
 * pass a fixed function and the output is fully reproducible.
 */
export function generatePalette({
  count,
  scheme,
  baseHue,
  random = Math.random,
}: {
  count: number;
  scheme: HarmonyScheme;
  baseHue?: number;
  random?: () => number;
}): string[] {
  const base = baseHue ?? random() * 360;
  const offsets = HARMONY_SCHEMES[scheme];
  const colors: string[] = [];

  for (let i = 0; i < count; i++) {
    // A little jitter keeps the hues from looking mechanically exact.
    const hue = base + offsets[i % offsets.length] + (random() * 10 - 5);
    // Dark to light across the palette, so it's immediately usable as a ramp.
    const t = count === 1 ? 0.5 : i / (count - 1);
    const lightness = 22 + t * 60;
    const saturation = 45 + random() * 35;
    colors.push(hslToHex(hue, saturation, lightness));
  }

  return colors;
}

/**
 * sRGB values are gamma-encoded: 128 is not half as much *light* as 255. Any
 * math that models physical light -- luminance, color-vision simulation,
 * blending -- has to undo that encoding first, work in linear light, then
 * re-apply it. Skipping this is the single most common color-math bug.
 */
function srgbToLinear(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const v = c <= 0.00304 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(1, v));
}

/**
 * WCAG relative luminance: how bright a color actually looks, 0 (black) to
 * 1 (white). The 0.2126 / 0.7152 / 0.0722 coefficients are only correct once
 * the channels are linearized -- applying them to raw sRGB (as this app used
 * to) gives an answer plausible enough to look right and still wrong.
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => srgbToLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ── Color vision deficiency ──────────────────────────────────────────────────

/**
 * Viénot, Brettel & Mollon (1999) projections, applied to *linear* RGB. Each
 * collapses the colors onto the plane that the given dichromat can actually
 * distinguish -- which is why red and green converge under protanopia and
 * deuteranopia, rather than the whole image turning grey.
 */
const CVD_MATRICES = {
  protanopia: [
    [0.170556, 0.829444, 0.0],
    [0.170556, 0.829444, 0.0],
    [-0.004517, 0.004517, 1.0],
  ],
  deuteranopia: [
    [0.33066, 0.66934, 0.0],
    [0.33066, 0.66934, 0.0],
    [-0.027855, 0.027855, 1.0],
  ],
  tritanopia: [
    [1.0, 0.1274, -0.1274],
    [0.0, 0.873909, 0.126091],
    [0.0, 0.873909, 0.126091],
  ],
} as const;

export type ColorVision = keyof typeof CVD_MATRICES;

export const COLOR_VISION_LABELS: Record<ColorVision, string> = {
  protanopia: "Protanopia (no red cones)",
  deuteranopia: "Deuteranopia (no green cones)",
  tritanopia: "Tritanopia (no blue cones)",
};

/** How a color appears to someone with the given color vision deficiency. */
export function simulateColorVision(hex: string, vision: ColorVision): string {
  const m = CVD_MATRICES[vision];
  const [r, g, b] = hexToRgb(hex).map((v) => srgbToLinear(v / 255));

  const project = (row: readonly number[]) =>
    linearToSrgb(row[0] * r + row[1] * g + row[2] * b) * 255;

  return rgbToHex(project(m[0]), project(m[1]), project(m[2]));
}

/**
 * Perceptual-ish distance between two colors, 0 (identical) upward. Weighted to
 * match how the eye actually trades off the channels -- a plain RGB distance
 * badly overrates blue.
 */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const rMean = (r1 + r2) / 2;
  const dr = r1 - r2,
    dg = g1 - g2,
    db = b1 - b2;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
      4 * dg * dg +
      (2 + (255 - rMean) / 256) * db * db,
  );
}

/** Below this, two colors are close enough to be practically the same swatch. */
export const CONFUSABLE_THRESHOLD = 40;

export interface ConfusablePair {
  a: number;
  b: number;
  distance: number;
}

/**
 * Pairs that a viewer with this deficiency would struggle to tell apart, but
 * which look distinct to full-color vision. Pairs that are already near-
 * identical to everyone are excluded -- that's a duplicate, not an
 * accessibility problem, and the app flags those separately.
 */
export function findConfusablePairs(
  hexes: string[],
  vision: ColorVision,
): ConfusablePair[] {
  const pairs: ConfusablePair[] = [];
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      if (colorDistance(hexes[i], hexes[j]) < CONFUSABLE_THRESHOLD) continue;
      const distance = colorDistance(
        simulateColorVision(hexes[i], vision),
        simulateColorVision(hexes[j], vision),
      );
      if (distance < CONFUSABLE_THRESHOLD) pairs.push({ a: i, b: j, distance });
    }
  }
  return pairs.sort((x, y) => x.distance - y.distance);
}
