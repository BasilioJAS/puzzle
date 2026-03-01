# Puzzle Quest — Jules Onboarding Guide

> **Live preview:** https://basiliojas.github.io/puzzle/  
> **Repo:** https://github.com/BasilioJAS/puzzle  
> Every push to `main` → GitHub Actions builds and deploys automatically (~1-2 min).

---

## What is this project?

A mobile-first **puzzle game** running on a raw HTML5 Canvas. No game engine (no Phaser, no Pixi). Written in **TypeScript**, bundled with **Vite**. The player drags puzzle pieces from a tray into a grid; pieces snap when placed correctly. There's a timer, stars rating, power-ups, a shop, and a level map.

---

## Project Structure

```
puzzle/
├── index.html              # Single HTML entry point — loads canvas + main bundle
├── vite.config.ts          # Vite config (base: '/puzzle/' for GitHub Pages)
├── tsconfig.json           # TypeScript config (strict, resolveJsonModule, vite/client types)
├── package.json            # version field — auto-bumped on every push to main
├── public/
│   ├── game_config.json    # ⭐ ALL game data: levels, assets, layout, shop, settings
│   └── assets/
│       ├── images/         # PNG sprites (puzzle images, icons, UI buttons)
│       └── sounds/         # .aif sound effects
└── src/
    ├── Main.ts             # Entry point: wires everything together, runs the game loop
    ├── types/
    │   └── GameTypes.ts    # All shared interfaces & enums (GameState, PuzzlePiece, etc.)
    ├── core/
    │   ├── ConfigLoader.ts # Fetches and parses game_config.json
    │   ├── AssetManager.ts # Loads images/sounds, returns HTMLImageElement / AudioBuffer
    │   ├── InputManager.ts # Unified mouse + touch → GamePointerEvent
    │   ├── SaveManager.ts  # localStorage persistence (gold, gems, levels, power-ups)
    │   └── StateManager.ts # Scene state machine (Boot → Preload → Splash → Map → Game)
    ├── scenes/
    │   ├── BootScene.ts    # Loads game_config.json, transitions to Preload
    │   ├── PreloadScene.ts # Loads all images/sounds via AssetManager, shows progress bar
    │   ├── SplashScene.ts  # Logo splash screen (tap to skip)
    │   ├── MapScene.ts     # Level selection map with star badges and lock state
    │   ├── GameScene.ts    # ⭐ Main gameplay — drag/drop, timer, power-ups, win/lose
    │   └── ShopScene.ts    # Buy power-ups with gold/gems
    └── ui/
        ├── UIElement.ts    # Base UI primitives: Button, Label, Panel (canvas-drawn)
        ├── UIManager.ts    # Coordinates UI overlays (win panel, game over panel)
        └── CheatMenu.ts    # Debug overlay (🐛 button): skip time, add gold, pass level, etc.
```

---

## Key Architecture Concepts

### Scene State Machine
`StateManager` holds a map of `GameState → Scene`. Call `stateManager.changeState(GameState.X)` to transition. Each scene implements:
```ts
interface Scene {
    enter(ctx): void   // called once on transition in
    exit(): void       // called once on transition out
    update(dt): void   // called every frame (dt = seconds)
    render(ctx): void  // called every frame after update
    onPointer?(event): void  // optional input handler
}
```

### Game Config (`public/game_config.json`)
Single source of truth for everything data-driven:
- `assets.images` / `assets.sounds` — file paths (relative to `public/`)
- `levels[]` — array of 50 levels (`id`, `pieces`, `timeLimit`, `image`, `cols`, `rows`)
- `layout.portrait` / `layout.landscape` — normalized layout rects (0–1) for grid, tray, topBar
- `shop.powerUps[]` — items with cost and currency type
- `settings` — starting currencies, win reward amounts, star thresholds

### Asset Paths
Assets in `public/assets/` are referenced in `game_config.json` as relative paths (e.g. `"assets/images/logo.png"`). The `AssetManager` prepends `import.meta.env.BASE_URL` when loading, so they work both locally and on GitHub Pages.

> ⚠️ **Same rule applies for any `fetch()` calls.** Always use `` `${import.meta.env.BASE_URL}your_file` `` instead of `'/your_file'`. The `base` in `vite.config.ts` is `/puzzle/` for production.

### Power-ups
Defined in `PowerUpType` enum (`src/types/GameTypes.ts`):
- `skip` — skip the level
- `hint` — highlights a piece's correct slot
- `fitForce` — tap a piece to lock it in its current position (swaps target with the displaced piece)
- `slowTime` — slows the timer for 15 seconds

### Save System
`SaveManager` reads/writes to `localStorage` under the key `puzzlequest_save`. Shape: `PlayerSave` interface in `GameTypes.ts`. If save is missing or corrupt, it resets to defaults from `settings` in the config.

### CheatMenu
A small 🐛 debug button always visible in top-left. When opened, shows:
- ⏩ Skip 90% Time
- 🪙 +1000 Gold
- 💎 +100 Gems
- ⏭️ Pass Level
- 👁️ Toggle piece IDs
- 🗑️ Reset Save

The version number (`v1.0.x`) is shown inside the cheat panel. It's read from `package.json` via `import pkg from '../../package.json'`.

---

## Deploy Workflow

### How it works
Every push to `main` triggers `.github/workflows/deploy.yml`:
1. Installs dependencies (`npm ci`)
2. Bumps patch version in `package.json` and commits it back
3. Runs `npm run build` (`tsc && vite build`)
4. Publishes the `dist/` folder to **GitHub Pages**

The live URL is always: **https://basiliojas.github.io/puzzle/**

### Making changes with Jules
1. Edit code normally — Jules handles commits and pushes to `main`
2. Push to `main` → GitHub Actions kicks off automatically
3. After ~1-2 minutes, the live URL reflects the changes
4. The version number in the 🐛 cheat menu updates automatically on each push

### Run locally (on your machine)
```bash
npm install
npm run dev
# Opens at http://localhost:3000
```

> ⚠️ Local dev uses `base: '/'` (Vite default when not building), so everything works normally.

### Build & preview locally
```bash
npm run build     # outputs to dist/
npm run preview   # serves dist/ locally
```

---

## conventions

- **No external game engine** — everything is vanilla Canvas 2D API
- **No React / no framework** — plain TypeScript classes
- **Data-driven design** — if you're adding a new level, power-up, or asset, edit `game_config.json` first
- **Normalized layout** — layout values `0–1` mean "fraction of canvas width/height"; fixed pixel values (like `44`) are used for small fixed-size UI panels
- **`import.meta.env.BASE_URL`** — always use this for any runtime file fetch, never hardcode `/`
- **Version** — lives in `package.json`, auto-incremented on every push by the CI workflow
