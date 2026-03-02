// ─── Game State Machine ───
export enum GameState {
    Boot = 'Boot',
    Preload = 'Preload',
    Splash = 'Splash',
    MainMenu = 'MainMenu',
    Gameplay = 'Gameplay',
    Shop = 'Shop',
    GameOver = 'GameOver',
    Win = 'Win',
}

// ─── Power-Up Types ───
export enum PowerUpType {
    Skip = 'skip',
    Hint = 'hint',
    FitForce = 'fitForce',
    SlowTime = 'slowTime',
}

// ─── Config Interfaces ───
export interface LayoutRect {
    x: number; y: number; w: number; h: number;
}

export interface OrientationLayout {
    topBar: LayoutRect;
    grid: LayoutRect;
    tray: LayoutRect;
    trayDirection: 'horizontal' | 'grid';
    powerUps: LayoutRect;
}

export interface LayoutConfig {
    portrait: OrientationLayout;
    landscape: OrientationLayout;
}

export interface GameConfig {
    assets: AssetConfig;
    localization: Record<string, Record<string, string>>;
    levels: LevelConfig[];
    shop: ShopConfig;
    settings: SettingsConfig;
    layout?: LayoutConfig;
}

export interface AssetConfig {
    images: Record<string, string>;
    sounds: Record<string, string>;
}

export interface LevelConfig {
    id: number;
    timeLimit: number;
    // Runtime deduced fields when probing level:
    pieces: number;
    cols: number;
    rows: number;
    piecesFolder?: string;
    image?: string; // fallback
}

export interface ShopItem {
    id: string;
    name: string;
    cost: number;
    currency: 'soft' | 'hard';
    icon: string;
    description: string;
}

export interface ShopConfig {
    powerUps: ShopItem[];
}

export interface SettingsConfig {
    startSoftCurrency: number;
    startHardCurrency: number;
    winSoftReward: number;
    winHardReward: number;
    star3Pct: number; // % of time remaining for 3 stars (e.g. 0.6 = 60%)
    star2Pct: number; // % of time remaining for 2 stars (e.g. 0.3 = 30%)
    unplacedPieceGrayscale: number; // 0 to 1 scale for grayscale effect on unplaced pieces
}

// ─── Player Save Data ───
export interface PlayerSave {
    unlockedLevel: number;
    stars: number[];
    softCurrency: number;
    hardCurrency: number;
    combo: number; // win streak, max 5
    powerUps: Record<string, number>;
}

// ─── Pointer Event (unified mouse/touch) ───
export type PointerEventType = 'down' | 'move' | 'up' | 'wheel';

export interface GamePointerEvent {
    x: number;
    y: number;
    type: PointerEventType;
    nativeEvent?: MouseEvent | TouchEvent;
}

// ─── Puzzle Piece ───
export interface PuzzlePiece {
    id: number;
    col: number;
    row: number;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    width: number;
    height: number;
    placed: boolean;
    dragging: boolean;
    sx: number; // source x in the image
    sy: number; // source y in the image
    sw: number; // source width
    sh: number; // source height
    imageKey?: string; // Optional: Si tiene esta key, usamos un asset cargado y se ignora el sx/sy/sw/sh del grid
    // Animation fields
    animScale: number;
    animScaleTarget: number;
    animRotation: number;
    animOffsetY: number;
    dragVelX: number;
    dragVelY: number;
    snapAnim: number; // 0-1 for snap bounce
    prevX: number;
    prevY: number;
}

// ─── Scene Interface ───
export interface Scene {
    enter(ctx: CanvasRenderingContext2D): void;
    exit(): void;
    update(dt: number): void;
    render(ctx: CanvasRenderingContext2D): void;
    onPointer?(event: GamePointerEvent): void;
}
