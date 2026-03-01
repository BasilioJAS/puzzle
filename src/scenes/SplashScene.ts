import { Scene, GameState, GamePointerEvent } from '../types/GameTypes';
import { StateManager } from '../core/StateManager';
import { AssetManager } from '../core/AssetManager';
import { ConfigLoader } from '../core/ConfigLoader';

export class SplashScene implements Scene {
    private stateManager: StateManager;
    private assetManager: AssetManager;
    private configLoader: ConfigLoader;
    private elapsed: number = 0;

    constructor(stateManager: StateManager, assetManager: AssetManager, configLoader: ConfigLoader) {
        this.stateManager = stateManager;
        this.assetManager = assetManager;
        this.configLoader = configLoader;
    }

    enter(_ctx: CanvasRenderingContext2D): void {
        this.elapsed = 0;
    }

    exit(): void { }

    update(dt: number): void {
        this.elapsed += dt;
    }

    render(ctx: CanvasRenderingContext2D): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Background
        const grad = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w);
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(1, '#0f0c29');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Animated particles (decorative)
        ctx.save();
        for (let i = 0; i < 30; i++) {
            const px = ((i * 137.508 + this.elapsed * 10) % w);
            const py = ((i * 97.7 + this.elapsed * (5 + i % 3)) % h);
            const size = 2 + (i % 3);
            const alpha = 0.1 + 0.15 * Math.sin(this.elapsed * 2 + i);
            ctx.fillStyle = `rgba(165, 180, 252, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Logo
        const logo = this.assetManager.getImage('logo');
        if (logo) {
            const logoSize = Math.min(w * 0.5, 256);
            const lx = (w - logoSize) / 2;
            const ly = h / 2 - logoSize / 2 - 40;
            ctx.drawImage(logo, lx, ly, logoSize, logoSize);
        } else {
            // Fallback: text logo
            ctx.fillStyle = '#c4b5fd';
            ctx.font = 'bold 48px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🧩 PUZZLE QUEST', w / 2, h / 2 - 60);
        }

        // Title
        ctx.fillStyle = '#e0e7ff';
        ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PUZZLE QUEST', w / 2, h / 2 + 30);

        // "Tap to continue" with pulsing opacity
        const tapText = this.configLoader.getText('tapToContinue');
        const alpha = 0.4 + 0.6 * Math.abs(Math.sin(this.elapsed * 2));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#a5b4fc';
        ctx.font = '20px "Segoe UI", Arial, sans-serif';
        ctx.fillText(tapText, w / 2, h / 2 + 80);
        ctx.globalAlpha = 1;
    }

    onPointer(event: GamePointerEvent): void {
        if (event.type === 'down') {
            this.stateManager.changeState(GameState.MainMenu);
        }
    }
}
