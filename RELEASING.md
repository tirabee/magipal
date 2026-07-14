# Releasing Magipal

## Before you start

The updater signs every release. The **private key lives at `~/.tauri/magipal.key`
and must never enter this repo.**

- **Back it up** in your password manager. If you lose it, you can never ship an
  update to anyone who already installed Magipal — they'd have to find and
  reinstall by hand. There is no recovery.
- **If it leaks**, anyone can push a signed "update" to every Magipal install,
  which is arbitrary code execution on your users' machines. Treat it like a
  password.

The matching public key is in `src-tauri/tauri.conf.json`. The app refuses any
update not signed by the private key, so a compromised GitHub account alone
cannot push a malicious update.

## 1. Bump the version

Edit **all three**, keeping them identical:

- `src-tauri/tauri.conf.json` ← authoritative; stamped into the binary and used
  by the updater to decide whether a release is newer
- `package.json`
- `src-tauri/Cargo.toml`

`npm test` fails if they disagree. (`tauri.conf.json`'s `version` only accepts a
literal semver — pointing it at `package.json` silently falls back to the
Cargo.toml version, which would ship a release stamped with the wrong number and
an updater that refuses to offer itself.)

## 2. Check it's actually releasable

```bash
npm test                     # frontend + version consistency
cd src-tauri && cargo test   # backend
npx tsc --noEmit             # vitest transpiles without typechecking, so run this too
```

## 3. Build, signed

The build only produces a `.sig` file if the signing key is in the environment.
**No `.sig` means no update can be published.**

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/magipal.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`:

- `nsis/magipal_<version>_x64-setup.exe` — the installer people download
- `nsis/magipal_<version>_x64-setup.nsis.zip` — what the updater downloads
- `nsis/magipal_<version>_x64-setup.nsis.zip.sig` — the signature

## 4. Publish the GitHub release

Tag it `v<version>` and attach:

- `magipal_<version>_x64-setup.exe`
- `magipal_<version>_x64-setup.nsis.zip`
- `latest.json` (below)

## 5. Write `latest.json`

The app fetches this from
`https://github.com/tirabee/magipal/releases/latest/download/latest.json`, so it
**must be attached to the release marked "latest"**.

```json
{
  "version": "0.9.0",
  "notes": "What changed, in plain language. This text is shown to the user.",
  "pub_date": "2026-07-13T00:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "PASTE THE ENTIRE CONTENTS OF THE .sig FILE HERE",
      "url": "https://github.com/tirabee/magipal/releases/download/v0.9.0/magipal_0.9.0_x64-setup.nsis.zip"
    }
  }
}
```

Gotchas that will silently break updates:

- `version` must **not** have a leading `v`. The tag does; this field doesn't.
- `signature` is the *contents* of the `.sig` file, not a path or a URL.
- The `url` must point at the `.nsis.zip`, not the `.exe`.
- The release must not be a draft or pre-release, or `/releases/latest/` skips it.

## 6. Verify the update actually works

Do not skip this. A broken updater is invisible until the *next* release, by
which point every user is stranded.

1. Install the **previous** version.
2. Launch it. It should offer the new version, show your notes, download, install
   and restart into it.
3. Check the status bar shows the new version number.

## Mac

Not yet. Needs a macOS builder (GitHub Actions) and a decision on the $99/yr
Apple Developer account — without notarization, macOS tells users the app is from
an unidentified developer and won't open it on a double-click.
