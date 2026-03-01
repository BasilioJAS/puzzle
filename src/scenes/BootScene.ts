import { Scene, GameState, GamePointerEvent } from '../types/GameTypes';
import { StateManager } from '../core/StateManager';
import { ConfigLoader } from '../core/ConfigLoader';

export class BootScene implements Scene {
    private stateManager: StateManager;
    private configLoader: ConfigLoader;
    private loading: boolean = false;
    private error: string = '';

    constructor(stateManager: StateManager, configLoader: ConfigLoader) {
        this.stateManager = stateManager;
        this.configLoader = configLoader;
    }

    enter(_ctx: CanvasRenderingContext2D): void {
        this.loading = true;
        this.error = '';
        this.configLoader
            .load(`${import.meta.env.BASE_URL}game_config.json`)
            .then(() => {
                this.loading = false;
                this.stateManager.changeState(GameState.Preload);
            })
            .catch((err: Error) => {
                this.loading = false;
                this.error = err.message;
            });
    }

    exit(): void { }

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Dark gradient background
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0f0c29');
        grad.addColorStop(0.5, '#302b63');
        grad.addColorStop(1, '#24243e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (this.error) {
            ctx.fillStyle = '#ff6b6b';
            ctx.fillText('Error loading config:', w / 2, h / 2 - 20);
            ctx.font = '16px "Segoe UI", Arial, sans-serif';
            ctx.fillText(this.error, w / 2, h / 2 + 20);
        } else if (this.loading) {
            ctx.fillText('Loading...', w / 2, h / 2);
        }
    }

    onPointer(_event: GamePointerEvent): void { }
}
