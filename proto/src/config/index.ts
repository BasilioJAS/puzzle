/**
 * Carga y acceso a la configuración. TODO lo editable (colores, medidas, textos,
 * iconos, sonidos, power-ups, precios) vive en public/config/game.config.json.
 * Ningún otro archivo debería tener literales de UI.
 */
import type { EarLibrary } from '../puzzle/ears';

export interface PowerUpConfig {
    id: string;
    icon: string;
    labelKey: string;
    startCount: number;
    price: number;
    highlightMs?: number;
    autoPlace?: boolean;
    addSeconds?: number;
}

export interface SfxDef { wave: OscillatorType; freq: number; to: number; dur: number; gain: number; }

export interface GameConfig {
    app: { title: string; subtitle: string; version: string; defaultLang: string };
    colors: Record<string, string>;
    metrics: Record<string, number>;
    icons: Record<string, string>;
    text: Record<string, Record<string, string>>;
    audio: {
        musicEnabledDefault: boolean; sfxEnabledDefault: boolean;
        musicVolume: number; sfxVolume: number;
        music: { bpm: number; wave: OscillatorType; notes: number[] };
        sfx: Record<string, SfxDef>;
    };
    haptics: { enabledDefault: boolean; patterns: Record<string, number[]> };
    powerups: { order: string[] } & Record<string, any>;
    shop: { startCoins: number; items: { id: string; amount: number; price: number; icon: string }[] };
    rewards: { coinsPerStar: number; coinsFirstClear: number };
    gameplay: {
        showGhostImage: boolean; ghostAlpha: number; showGrid: boolean;
        minZoom: number; maxZoom: number; doubleTapZoom: number;
        starThresholds: number[]; pieceShadow: boolean;
    };
    storageKey: string;
}

export interface TutorialConfig {
    enabled: boolean;
    target: string;       // id del power-up ("tip" | "time")
    text: string;
    anim: 'pulse' | 'shake' | 'bounce';
}

export interface PieceDef { col: number; row: number; file: string; ox: number; oy: number; }

export interface LevelConfig {
    id: string;
    name: string;
    image: string;
    thumb?: string;
    cols: number;
    rows: number;
    timeSec: number;
    ear: string;
    seed: number;
    imageW: number;
    imageH: number;
    cellW: number;
    cellH: number;
    margin: number;
    pieceW: number;
    pieceH: number;
    powerups: Record<string, boolean>;
    tutorial: TutorialConfig | null;
    pieces: PieceDef[];
    /** presente sólo en niveles creados con el editor y guardados en el dispositivo */
    custom?: boolean;
}

export interface Bundle {
    cfg: GameConfig;
    ears: EarLibrary;
    order: string[];
    lang: string;
}

let bundle: Bundle;

async function getJson<T>(url: string): Promise<T> {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`No pude cargar ${url} (${r.status})`);
    return r.json() as Promise<T>;
}

export async function loadBundle(): Promise<Bundle> {
    const [cfg, ears, index] = await Promise.all([
        getJson<GameConfig>('config/game.config.json'),
        getJson<EarLibrary>('config/ears.json'),
        getJson<{ levels: string[] }>('levels/index.json').catch(() => ({ levels: [] })),
    ]);
    bundle = { cfg, ears, order: index.levels, lang: cfg.app.defaultLang };
    applyTheme(cfg);
    return bundle;
}

export const C = () => bundle.cfg;
export const EARS = () => bundle.ears;
export const ORDER = () => bundle.order;

/** texto localizado */
export function t(key: string, vars?: Record<string, string | number>): string {
    const dict = bundle.cfg.text[bundle.lang] ?? {};
    let s = dict[key] ?? key;
    if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, String(vars[k]));
    return s;
}

/** ícono por nombre lógico */
export const ico = (key: string): string => bundle.cfg.icons[key] ?? '?';

/** medida por nombre lógico */
export const m = (key: string): number => bundle.cfg.metrics[key] ?? 0;

const KEBAB: Record<string, string> = {
    bgAlt: 'bg-alt', panelAlt: 'panel-alt', textDim: 'text-dim',
    boardGrid: 'board-grid', boardGhost: 'board-ghost', tutorialDim: 'tutorial-dim',
    maxAppWidth: 'max-app-width', safePadding: 'safe-pad', radiusSmall: 'radius-sm',
    hudHeight: 'hud-h', buttonHeight: 'btn-h', buttonHeightSmall: 'btn-h-sm',
    menuButtonGap: 'menu-gap', fontBase: 'font-base', fontTitle: 'font-title',
    fontHuge: 'font-huge', fontSmall: 'font-small', levelNodeSize: 'node-size',
    powerupSize: 'pu-size', powerupGap: 'pu-gap',
};

export function applyTheme(cfg: GameConfig): void {
    const s = document.documentElement.style;
    for (const [k, v] of Object.entries(cfg.colors)) s.setProperty(`--${KEBAB[k] ?? k}`, v);
    for (const [k, v] of Object.entries(cfg.metrics)) {
        const name = KEBAB[k];
        if (name) s.setProperty(`--${name}`, `${v}px`);
    }
    document.title = cfg.app.title;
}

/** Carga un nivel: primero busca en los niveles propios del dispositivo. */
export async function loadLevel(id: string): Promise<LevelConfig> {
    const custom = getCustomLevel(id);
    if (custom) return custom.level;
    return getJson<LevelConfig>(`levels/${id}/level.json`);
}

/** URL de un archivo del nivel (resuelve también los niveles guardados en el dispositivo). */
export function levelAsset(level: LevelConfig, file: string): string {
    if (level.custom) {
        const c = getCustomLevel(level.id);
        if (c && c.files[file]) return c.files[file];
    }
    return `levels/${level.id}/${file}`;
}

/* ---------- niveles propios (los que genera el editor) ---------- */

export const CUSTOM_KEY = 'puzzle-proto-custom-v1';

export interface CustomLevelRecord {
    level: LevelConfig;
    /** nombre de archivo -> data URL */
    files: Record<string, string>;
}

export function readCustomStore(): Record<string, CustomLevelRecord> {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '{}'); } catch { return {}; }
}

export function getCustomLevel(id: string): CustomLevelRecord | null {
    return readCustomStore()[id] ?? null;
}

export function saveCustomLevel(rec: CustomLevelRecord): void {
    const store = readCustomStore();
    rec.level.custom = true;
    store[rec.level.id] = rec;
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(store));
}

export function deleteCustomLevel(id: string): void {
    const store = readCustomStore();
    delete store[id];
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(store));
}

export function customLevelIds(): string[] {
    return Object.keys(readCustomStore()).sort();
}
