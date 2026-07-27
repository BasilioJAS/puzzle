# Design Brief — Build a Similar Puzzle Game From Scratch

> This document is a self-contained handoff. It describes an existing game's
> architecture, config schema, and tooling in enough detail that a fresh
> Claude session — with no access to this conversation and no prior context
> — can build a **new, similar game from scratch** without needing to read
> the original source.

## 0. Scope & constraints for the new build

- Build the new game **inside a new top-level folder in this same repo**
  (suggested name: `game-v2/`, adjust if it collides with something).
  Do **not** modify any existing root files (`src/`, `public/`,
  `vite.config.ts`, `package.json`, `.github/workflows/*`, `tools/`) — those
  belong to the original game and must keep working independently.
- The new folder should be a **fully standalone Vite + TypeScript project**:
  its own `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`,
  `src/`, `public/`. It should be buildable/runnable on its own
  (`cd game-v2 && npm install && npm run dev`).
- Reuse the architecture patterns below, but this is a **new game**, not a
  copy — reuse the *shape* of the code (scene state machine, config-driven
  data, save system, canvas rendering), not necessarily the exact puzzle
  mechanic, unless told otherwise.
- No external game engine (no Phaser/Pixi/Three), no UI framework (no
  React/Vue). Plain TypeScript classes drawing directly to a `<canvas>` 2D
  context. This keeps the bundle tiny and dependency-free.

---

## 1. What the reference game is

**Puzzle Quest** — a mobile-first jigsaw puzzle game. The player drags
puzzle pieces from a tray into a grid; pieces snap into place when dropped
near their correct slot. Features: countdown timer per level, a 3-star
rating based on time remaining, four power-ups, a shop (soft/hard
currency), and a saga-style level map with locked/unlocked/completed nodes.

Rendering is 100% Canvas 2D — no DOM elements for game UI (buttons, panels,
labels are all hand-drawn each frame). The only DOM element is the
`<canvas>` itself plus the page shell in `index.html`.

---

## 2. Tech stack

- **TypeScript** (strict mode) — `tsconfig.json`: `target: ES2020`,
  `module: ESNext`, `moduleResolution: bundler`, `resolveJsonModule: true`
  (needed to `import` JSON config/version directly), `strict: true`,
  include `vite/client` types.
- **Vite** as the only build tool (`vite build` for production, `vite dev`
  for local iteration). No bundler config beyond the basics.
- **No runtime dependencies** at all — `package.json` `dependencies` is
  empty; only `devDependencies` are `typescript` and `vite`.
- Assets are plain PNG/AIF (or any audio format the browser's
  `HTMLAudioElement` supports) served from `public/`.

## 3. Folder structure to replicate

```
game-v2/
├── index.html              # Single entry point: <canvas> + <script type="module" src="/src/Main.ts">
├── vite.config.ts          # base path, publicDir, build.outDir
├── tsconfig.json
├── package.json            # version field, scripts: dev/build/preview
├── public/
│   ├── game_config.json    # ⭐ single source of truth for all game data
│   └── assets/
│       ├── images/
│       └── sounds/
└── src/
    ├── Main.ts              # Entry point: wires everything, owns the game loop
    ├── types/
    │   └── GameTypes.ts      # All shared interfaces & enums
    ├── core/
    │   ├── ConfigLoader.ts   # Fetches + parses game_config.json (and any auxiliary data files)
    │   ├── AssetManager.ts   # Loads images/sounds, tracks progress, provides fallback placeholders
    │   ├── InputManager.ts   # Unifies mouse + touch + wheel into one GamePointerEvent stream
    │   ├── SaveManager.ts    # localStorage persistence, with default-on-missing-or-corrupt
    │   └── StateManager.ts   # Scene state machine
    ├── scenes/
    │   ├── BootScene.ts      # Loads config, shows loading/error state, transitions to Preload
    │   ├── PreloadScene.ts   # Loads all assets via AssetManager, shows a progress bar
    │   ├── SplashScene.ts    # Logo splash (tap to skip)
    │   ├── MapScene.ts       # Level/world selection screen (or main menu, if not a saga map)
    │   ├── GameScene.ts      # ⭐ Core gameplay loop
    │   └── ShopScene.ts      # Spend currency on items/power-ups
    └── ui/
        ├── UIElement.ts      # Canvas-drawn primitives: Button, Label, Panel
        ├── UIManager.ts      # Coordinates overlays (win panel, game-over panel, toasts)
        └── CheatMenu.ts       # Debug overlay for QA: skip time, add currency, pass level, etc.
```

---

## 4. Core architecture

### 4.1 Scene state machine

`StateManager` holds `GameState → Scene` and the currently active state.
Every scene implements:

```ts
interface Scene {
    enter(ctx: CanvasRenderingContext2D): void;   // once, on transition in
    exit(): void;                                  // once, on transition out
    update(dt: number): void;                       // every frame, dt in seconds
    render(ctx: CanvasRenderingContext2D): void;    // every frame, after update
    onPointer?(event: GamePointerEvent): void;      // optional input handler
}
```

`stateManager.changeState(GameState.X)` calls `exit()` on the old scene and
`enter()` on the new one. Only the active scene's `update`/`render` run.

`GameState` enum (adjust names to the new game's flow, keep the shape):
`Boot`, `Preload`, `Splash`, `MainMenu`, `Gameplay`, `Shop`, `GameOver`,
`Win`.

### 4.2 Game loop (in `Main.ts`)

- One `<canvas id="gameCanvas">` in `index.html`, sized via a
  `resizeCanvas()` function that:
  - uses a **fixed logical/design width** (e.g. `DESIGN_W = 480`) and
    computes `DESIGN_H` from the real window aspect ratio, so gameplay math
    is resolution-independent;
  - sets `canvas.width/height` to the logical resolution and
    `canvas.style.width/height` to the physical CSS size (letterboxed,
    centered via flexbox in `index.html`'s `<body>`);
  - informs `InputManager` of the scale factor so pointer coordinates map
    correctly from CSS pixels to logical pixels.
- `requestAnimationFrame` loop: compute `dt` (clamp to avoid huge jumps
  after a tab was backgrounded, e.g. `Math.min(dt, 0.1)`), clear the
  canvas, `stateManager.update(dt)`, `stateManager.render(ctx)`, then draw
  any always-on-top overlays (cheat menu, version number).
- The **version number** is imported directly from `package.json`
  (`import pkg from '../package.json'`) and drawn faintly in a corner —
  useful for confirming which build is live, especially across preview
  deployments.

### 4.3 Config-driven design (`public/game_config.json`)

Everything that isn't code lives here. Minimum shape:

```jsonc
{
  "assets": {
    "images": { "logo": "assets/images/logo.png", /* ...key: relative path... */ },
    "sounds": { "click": "assets/sounds/click.aif", /* ... */ }
  },
  "localization": {
    "en": { "play": "PLAY", "level": "Level", /* all UI strings, keyed */ }
  },
  "layout": {
    "portrait":  { "topBar": {"x":0,"y":0,"w":1.0,"h":60}, "grid": {...}, "tray": {...}, "trayDirection": "horizontal", "powerUps": {...} },
    "landscape": { /* same shape, different numbers */ }
  },
  "levels": [
    { "id": 1, "timeLimit": 120 /* + whatever fields the specific mechanic needs */ }
  ],
  "shop": {
    "powerUps": [
      { "id": "skip", "name": "Skip", "cost": 500, "currency": "soft", "icon": "icon_skip", "description": "..." }
    ]
  },
  "settings": {
    "startSoftCurrency": 100,
    "startHardCurrency": 5,
    "winSoftReward": 50,
    "winHardReward": 0,
    "star3Pct": 0.6,
    "star2Pct": 0.3
  }
}
```

Key rules:
- `layout` rects use **normalized 0–1 values** for `x/y/w/h` = fraction of
  canvas width/height, EXCEPT small fixed-size UI panels (like a power-up
  bar), which may use raw pixel values (document which fields are which).
- `ConfigLoader.load(url)` fetches this file (and may merge in auxiliary
  JSON files, e.g. a generated per-level metadata file, if the level data
  needs to be computed by an offline tool — see §6).
- Adding a level/power-up/asset means **editing this JSON first**, not
  writing new code paths.

### 4.4 Asset loading (`AssetManager`)

- `loadImagesAndSounds(imageMap, soundMap)` loads everything up front
  (used by `PreloadScene`), tracking `loadedAssets/totalAssets` for a
  progress bar.
- `loadExtraImages(imageMap)` loads additional images on demand later
  (e.g. per-level art) without resetting progress tracking.
- **Never let a missing asset crash the game**: on `img.onerror`, generate
  a colored placeholder canvas with the asset's key drawn as text, convert
  it to a data URL, and use that instead. This means the game is always
  playable (with ugly placeholders) even if art is missing — useful during
  early development before final art exists.
- Sounds use plain `HTMLAudioElement`; `playSound(key, volume)` resets
  `currentTime` and calls `.play()`, swallowing rejected-promise errors
  (autoplay policies) with a `console.warn`.

### 4.5 Input (`InputManager`)

- Binds `mousedown/mousemove/mouseup`, `touchstart/touchmove/touchend`
  (all with `preventDefault` on touch to stop scrolling/zooming), and
  `wheel` (for desktop zoom, if relevant).
- Converts every event into one shared shape:
  `{ x, y, type: 'down'|'move'|'up'|'wheel', nativeEvent }`, with `x/y`
  already converted from CSS pixels to **logical canvas pixels** via the
  scale factor from `resizeCanvas()`.
- One `onPointer(callback)` registration point; `Main.ts` routes every
  event first to a cheat menu (if open, it swallows the event) then to the
  active scene's `onPointer`.

### 4.6 Save system (`SaveManager`)

- One `localStorage` key (e.g. `mygame_save`), JSON-serialized.
- Constructor reads existing save; on missing key or JSON parse failure,
  falls back to `createDefault(settings)` built from
  `game_config.json`'s `settings` block (starting currencies, etc.) — the
  game must never hard-crash on a corrupt save.
- Include a **migration pattern**: when adding a new save field later,
  check `if (parsed.newField === undefined) parsed.newField = <default>`
  right after parsing, so existing players' saves upgrade in place instead
  of resetting.
- Minimal shape to adapt: unlocked progress marker, per-level rating
  array, soft/hard currency balances, a win-streak/combo counter, and a
  `Record<string, number>` bag for consumable power-up counts. Every
  mutating method calls `save()` (write-through, no manual flush needed).

### 4.7 UI layer

- `UIElement.ts`: base canvas-drawn primitives (`Button`, `Label`,
  `Panel`) — each knows how to `render(ctx)` and hit-test a point for
  click handling. No DOM, no CSS for these.
- `UIManager.ts`: coordinates transient overlays that any scene can
  trigger (a win panel, a game-over panel, a toast/snackbar for "not
  enough currency", etc.) so scenes don't each reimplement modal logic.
- `CheatMenu.ts`: an always-visible small debug-button overlay (top
  corner) that, when opened, exposes dev shortcuts — e.g. skip most of the
  timer, add currency, pass the current level instantly, toggle debug
  labels, reset save. Also a convenient place to display the running
  build's version number. Gate this behind nothing special for now (it's
  a small hobby/prototype project), but keep it visually unobtrusive.

---

## 5. Gameplay mechanics to design (adapt freely — this is the reference shape)

- **Timer**: counts down from `level.timeLimit`; reaching 0 before the
  board is solved triggers a lose/GameOver state.
- **Star rating**: compare fraction of time remaining against thresholds
  from `settings` (e.g. `star3Pct`, `star2Pct`) to award 1–3 stars on win.
  `SaveManager.setStars(levelId, stars)` keeps the **best** score, never
  downgrades.
- **Level unlocking**: completing level N unlocks level N+1 only if the
  player hadn't already unlocked further (`unlockNextLevel` is a no-op if
  a later level is already unlocked).
- **Win/streak combo**: increments (capped, e.g. at 5) on each win, resets
  on a loss — use it to scale a reward multiplier or cosmetic flair.
- **Power-ups** (adapt to the new mechanic, but keep the shape of
  "consumable, purchasable, has a gameplay effect, tracked as a count in
  the save"). Reference set for a drag-and-drop puzzle: *skip level*,
  *hint* (reveal a piece's correct slot), *force-fit* (lock a piece into
  its current slot, swapping whatever was already there), *slow time*
  (temporarily reduce the timer's countdown rate).
- **Shop**: list of purchasable items with `cost` + `currency` ('soft' or
  'hard'); buying decrements the appropriate balance via
  `SaveManager.spendSoft/spendHard` (which return `false` and change
  nothing if the balance is insufficient) and increments the power-up
  count via `addPowerUp`.
- **Drag & drop + snapping**: on pointer-down over a tray piece, mark it
  `dragging`; on pointer-move, follow the pointer (optionally with a
  little lag/velocity-based squash-and-stretch for juice); on pointer-up,
  check distance from the piece's target slot against a snap-distance
  threshold — within it, lock the piece (`placed = true`, snap `x/y` to
  `targetX/targetY`, play a snap sound/animation); outside it, return the
  piece to the tray (or leave it wherever dropped, depending on desired
  feel).

---

## 6. Content/asset tooling (optional — replicate only if the new game needs a similar offline pipeline)

The reference project has a `tools/` folder of standalone Python scripts
used **outside the build**, to prepare assets checked into `public/`
ahead of time (not run at runtime or in CI):

- `puzzle_mask_generator.py` — generates black/white PNG masks for each
  grid cell of a jigsaw layout (cols × rows), used as a cutting template.
- `puzzle_piece_cutter.py` — combines a source image + a folder of masks
  to produce transparent per-piece PNGs (`piece_<row>_<col>.png`).
- `process_level.py` — orchestrates the two steps above for one level,
  reading level `cols/rows` from a difficulty-curve JSON.
- `difficulty_generator/level_curve_generator.py` — generates the
  cols/rows/time-limit progression across all levels (the "difficulty
  curve").
- `compile_meta.py` — walks the generated per-level asset folders and
  compiles a single metadata JSON (piece counts, true cropped cell
  pixel sizes) that `ConfigLoader` merges into level configs at runtime.
- `batch_generate_images.py` — calls a local image-generation backend
  (e.g. ComfyUI) with a fixed master style prompt to batch-produce
  consistent-looking source art.
- Two standalone HTML tools (`puzzle_crop_tool.html`, `puzzle_tuner.html`)
  for manually eyeballing/adjusting crops in a browser, no server needed.

If the new game's core mechanic doesn't need per-level image slicing,
skip this whole section — it's specific to jigsaw-style content
prep, not part of the generic architecture.

---

## 7. Conventions to carry over

- **Data-driven**: new level/item/asset → edit `game_config.json` first,
  write code only for genuinely new *behavior*.
- **Normalized layout**: document clearly, per layout rect, whether its
  numbers are 0–1 fractions or fixed pixels — mixing them silently is a
  common source of layout bugs.
- **`import.meta.env.BASE_URL`** — every runtime `fetch()` of a public
  asset must be prefixed with this, never a hardcoded `/`, so the app
  works both at the Vite dev root and at whatever subpath it's deployed
  under later.
- **Never crash on missing/corrupt data** — bad save → reset to defaults;
  missing asset → placeholder; missing config field → sane fallback.
- **No comments explaining *what* the code does** — name things clearly
  instead; comment only genuinely non-obvious *why* (a workaround, a
  subtle invariant).
- Keep the whole thing framework-free and dependency-free; the appeal of
  this architecture is that it's tiny, fast to load on mobile, and has
  zero supply-chain surface.

---

## 8. What to actually deliver

1. A new standalone project under `game-v2/` (or whatever name avoids
   collisions) with the structure from §3, fully building via
   `npm install && npm run build` and running via `npm run dev`.
2. A working vertical slice: boot → preload → a main menu/map → one
   playable level → a win or lose screen — even with placeholder art and
   only 2–3 levels of config data.
3. A short `game-v2/README.md` explaining what the new game's core loop
   is (if it diverges from jigsaw puzzles) and how to run it locally.
