# Contributing to Magipal

Thanks for wanting to help! Magipal is a small, opinionated tool, and it's built
by one person — so the most useful thing you can do is talk to me before writing
a lot of code.

## Before you build something

**Open an issue first** for anything bigger than a bug fix. Not to gatekeep, but
because it's genuinely sad to review a thoughtful PR that doesn't fit the app's
direction, and worse to *merge* one that doesn't. A quick "I'd like to add X,
does that fit?" saves us both.

Bug reports are always welcome with no ceremony. If you can, include what you
did, what you expected, and what happened instead.

## Getting set up

```bash
git clone https://github.com/tirabee/magipal.git
cd magipal
npm install
npm run tauri dev
```

You'll need [Node](https://nodejs.org/) 18+, [Rust](https://rustup.rs/), and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform.

## Running the checks

```bash
npm test                     # frontend tests
npx tsc --noEmit             # typecheck — see the note below
cd src-tauri && cargo test   # backend tests
```

**Run `tsc` as well as `npm test`.** Vitest transpiles without typechecking, so a
type error can sail through a fully green test run.

## How the app is put together

```
src/
  App.tsx        root component; PaletteView and the mutation handlers
  Sidebar.tsx    folders + drag and drop (dnd-kit)
  storage.ts     every Tauri `invoke` wrapper, and the TS types mirroring Rust
  color.ts       ALL color math — conversions, harmonies, color-vision simulation
  history.ts     undo/redo (pure state; no React, no disk)
  *Modal.tsx     one per dialog; they share the `modal-overlay` / `modal` markup

src-tauri/src/lib.rs   every Rust command, and the data structs
```

### Three rules worth knowing

**1. Every change to saved data goes through `App.mutate()`.**

Undo works by snapshotting the whole `AppData` before each change. `mutate()` is
also the only code that reloads and re-renders after a change — so if you mutate
without it, the UI won't refresh and you'll notice immediately. (`Sidebar` gets
it as the `onMutate` prop.) Please don't call a storage function directly from a
component.

**2. Invariants live in Rust, not at the call sites.**

The palette lock (`check_lock`) and the color limit (`check_limit`) are enforced
in `save_palette`, so no UI path can violate them by forgetting to check. This is
deliberate: the lock *used* to be checked at each call site, and it was silently
missing from four of the five import paths. If you add a rule about what a valid
palette is, put it there.

**3. Never address a color by its position on screen.**

Sorting reorders the view, so a color's index in the rendered list is not its
index in storage. `sortColors` returns `PositionedColor` — `{ color, index }` —
where `index` is the real position in `palette.colors`. Use that. (Yes, this was
a bug once: sorting by hue and deleting the third swatch deleted whatever was
third *on disk*.)

### Adding a Rust command

Two places, or it silently doesn't exist to the frontend:

1. the `#[tauri::command] fn` itself
2. an entry in `invoke_handler![...]` in `run()`

Then a wrapper in `storage.ts`.

Note that Rust's `Option<T>` serializes to **`null`**, not to a missing field. A
TypeScript `foo?: number` will therefore receive `null`, and `foo !== undefined`
will be *true* for it. Compare with `== null`. (This one shipped a bug too.)

## Style

- Match the surrounding code. There's no linter to argue with you.
- Comments should say *why*, not *what*. If a line looks wrong but is right,
  that's worth a sentence. If it's obvious, leave it alone.
- Test pure logic (color math, history, parsing). Don't write tests that just
  re-assert what the type system already guarantees.

## Commits and PRs

Write commit messages that explain the reasoning, not just the change — "fix bug"
tells the next person nothing. Say what was broken, why, and what you did about
it.

Keep PRs focused. One idea per PR is much easier to review than five.

## A note on scope

Magipal is a palette *manager*, not an image editor. Features that pull it toward
being a general graphics tool will probably get a friendly no. Things that make
managing, generating, checking, and exporting palettes better are very welcome.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE), same as the rest of the project.
