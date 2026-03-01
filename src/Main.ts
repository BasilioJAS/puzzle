import { GameState } from './types/GameTypes';
import { ConfigLoader } from './core/ConfigLoader';
import { AssetManager } from './core/AssetManager';
import { InputManager } from './core/InputManager';
import { SaveManager } from './core/SaveManager';
import { StateManager } from './core/StateManager';
import { UIManager } from './ui/UIManager';
import { CheatMenu } from './ui/CheatMenu';

import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { SplashScene } from './scenes/SplashScene';
import { MapScene } from './scenes/MapScene';
import { GameScene } from './scenes/GameScene';
import { ShopScene } from './scenes/ShopScene';
import pkg from '../package.json';

const APP_VERSION = pkg.version;

// ─── Canvas Setup ───
const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Logical resolution — base width fixed, height adapts to aspect ratio
const DESIGN_W = 480;
let DESIGN_H = 854; // recalculated on init

function resizeCanvas(): void {
    const displayW = window.innerWidth;
    const displayH = window.innerHeight;

    // Cap to phone-like max width
    const maxW = 480;
    const cappedW = Math.min(displayW, maxW);
    const cappedH = Math.round(cappedW * (displayH / displayW));

    const aspect = displayH / displayW;

    // Adapt logical height to match physical aspect ratio
    DESIGN_H = Math.round(DESIGN_W * aspect);

    canvas.width = DESIGN_W;
    canvas.height = DESIGN_H;

    // Let CSS handle max-width and centering; just set aspect-appropriate sizing
    canvas.style.width = `${cappedW}px`;
    canvas.style.height = `${cappedH}px`;

    inputManager?.updateScale(DESIGN_W, DESIGN_H);
}

// ─── Core Systems ───
const configLoader = new ConfigLoader();
const assetManager = new AssetManager();
const uiManager = new UIManager();
const inputManager = new InputManager(canvas);
const stateManager = new StateManager(ctx);
const cheatMenu = new CheatMenu();

// SaveManager is created after config loads
let saveManager: SaveManager;
let gameSceneRef: GameScene;

// ─── Scenes ───
const bootScene = new BootScene(stateManager, configLoader);

function initAfterBoot(): void {
    const config = configLoader.getConfig();
    saveManager = new SaveManager(config.settings);

    const preloadScene = new PreloadScene(stateManager, configLoader, assetManager, uiManager);
    const splashScene = new SplashScene(stateManager, assetManager, configLoader);
    const mapScene = new MapScene(stateManager, configLoader, assetManager, saveManager, uiManager);
    const gameScene = new GameScene(stateManager, configLoader, assetManager, saveManager, uiManager);
    const shopScene = new ShopScene(stateManager, configLoader, saveManager, uiManager);

    gameSceneRef = gameScene;

    // Wire callbacks
    mapScene.onSelectLevel = (level) => {
        gameScene.setLevel(level);
    };
    mapScene.onOpenShop = () => { };

    // Configure cheat menu
    cheatMenu.configure({
        saveManager,
        onSkipTime: () => {
            if (stateManager.getCurrentState() === GameState.Gameplay) {
                gameSceneRef.skipTime();
            }
        },
        onPassLevel: () => {
            if (stateManager.getCurrentState() === GameState.Gameplay) {
                gameSceneRef.triggerWin();
            }
        },
        onReset: () => {
            localStorage.clear();
            location.reload();
        },
        onToggleShowId: () => {
            if (stateManager.getCurrentState() === GameState.Gameplay) {
                gameSceneRef.toggleShowId();
            }
        }
    });

    stateManager.registerScene(GameState.Preload, preloadScene);
    stateManager.registerScene(GameState.Splash, splashScene);
    stateManager.registerScene(GameState.MainMenu, mapScene);
    stateManager.registerScene(GameState.Gameplay, gameScene);
    stateManager.registerScene(GameState.Shop, shopScene);
}

// Override Boot scene
bootScene.enter = function (_c: CanvasRenderingContext2D) {
    configLoader
        .load(`${import.meta.env.BASE_URL}game_config.json`)
        .then(() => {
            initAfterBoot();
            stateManager.changeState(GameState.Preload);
        })
        .catch((err: Error) => {
            console.error('Failed to load config:', err);
        });

    bootScene.render = function (renderCtx: CanvasRenderingContext2D) {
        const w = renderCtx.canvas.width;
        const h = renderCtx.canvas.height;
        const grad = renderCtx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0f0c29');
        grad.addColorStop(0.5, '#302b63');
        grad.addColorStop(1, '#24243e');
        renderCtx.fillStyle = grad;
        renderCtx.fillRect(0, 0, w, h);

        renderCtx.fillStyle = '#a5b4fc';
        renderCtx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
        renderCtx.textAlign = 'center';
        renderCtx.textBaseline = 'middle';
        renderCtx.fillText('🧩 Loading...', w / 2, h / 2);
    };
};

stateManager.registerScene(GameState.Boot, bootScene);

// ─── Input Routing ───
inputManager.onPointer((event) => {
    // Cheat menu gets first priority
    if (cheatMenu.handlePointer(event)) return;

    const currentState = stateManager.getCurrentState();
    const scene = stateManager.getScene(currentState);
    if (scene?.onPointer) {
        scene.onPointer(event);
    }
});

// ─── Game Loop ───
let lastTime = 0;

function gameLoop(timestamp: number): void {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // cap dt at 100ms
    lastTime = timestamp;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update & Render
    stateManager.update(dt);
    stateManager.render(ctx);

    // Cheat overlay on top of everything
    cheatMenu.update(dt);
    cheatMenu.render(ctx);

    // Render Version number at the top of the game
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`v${APP_VERSION}`, canvas.width / 2, 4);

    requestAnimationFrame(gameLoop);
}

// ─── Initialize ───
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Start
stateManager.changeState(GameState.Boot);
requestAnimationFrame((t) => {
    lastTime = t;
    gameLoop(t);
});

console.log('🧩 Puzzle Quest — Started');
