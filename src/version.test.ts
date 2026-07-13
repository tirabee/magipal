import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Relative to this file, so the test doesn't depend on the working directory. */
const repoFile = (path: string) =>
  fileURLToPath(new URL(`../${path}`, import.meta.url));

/**
 * The app version lives in three files, and they must agree.
 *
 * tauri.conf.json is authoritative: it is stamped into the binary and is what
 * the updater compares against when deciding whether a release is newer. Its
 * `version` field accepts only a literal semver -- pointing it at package.json
 * does NOT work, it silently falls back to the Cargo.toml version. That failure
 * is invisible until you ship a release whose exe reports the wrong number and
 * whose updater therefore refuses to offer itself.
 *
 * So: bump all three, and let this test catch it when you forget one.
 */
describe("version", () => {
  const tauriConf = JSON.parse(
    readFileSync(repoFile("src-tauri/tauri.conf.json"), "utf-8"),
  );
  const pkg = JSON.parse(readFileSync(repoFile("package.json"), "utf-8"));
  const cargo = readFileSync(repoFile("src-tauri/Cargo.toml"), "utf-8");
  const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

  it("is a valid semver in tauri.conf.json", () => {
    expect(tauriConf.version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });

  it("matches in package.json", () => {
    expect(pkg.version).toBe(tauriConf.version);
  });

  it("matches in Cargo.toml", () => {
    expect(cargoVersion).toBe(tauriConf.version);
  });
});
