import { describe, it, expect } from "vitest";
import { colorLimit, remainingCapacity, newPalette } from "./storage";
import type { Palette } from "./storage";

function paletteWith(
  colors: number,
  max_colors?: number | null,
): Palette {
  return {
    id: "p",
    name: "P",
    colors: Array.from({ length: colors }, () => ({ hex: "#ff0000" })),
    created_at: 0,
    max_colors,
  };
}

describe("colorLimit", () => {
  it("treats Rust's null as uncapped, not as a cap of zero", () => {
    // Option<i64>::None serializes to `null`, not to a missing field. Reading
    // this as a number made every existing palette report itself as full.
    expect(colorLimit(paletteWith(6, null))).toBeNull();
    expect(remainingCapacity(paletteWith(6, null))).toBe(Infinity);
  });

  it("treats a missing field as uncapped", () => {
    expect(colorLimit(paletteWith(6, undefined))).toBeNull();
    expect(remainingCapacity(paletteWith(6, undefined))).toBe(Infinity);
  });

  it("reports a real cap", () => {
    expect(colorLimit(paletteWith(6, 16))).toBe(16);
    expect(remainingCapacity(paletteWith(6, 16))).toBe(10);
  });

  it("never reports negative capacity", () => {
    expect(remainingCapacity(paletteWith(20, 16))).toBe(0);
  });

  it("reports zero capacity at exactly the cap", () => {
    expect(remainingCapacity(paletteWith(16, 16))).toBe(0);
  });
});

describe("newPalette", () => {
  it("is uncapped by default", () => {
    expect(remainingCapacity(newPalette("Untitled"))).toBe(Infinity);
  });

  it("carries a cap when given one", () => {
    expect(colorLimit(newPalette("GB", undefined, 4))).toBe(4);
  });
});
