import { Scene, GameState, GamePointerEvent } from '../types/GameTypes';
import { StateManager } from '../core/StateManager';
import { ConfigLoader } from '../core/ConfigLoader';
import { AssetManager } from '../core/AssetManager';
import { UIManager } from '../ui/UIManager';
import { ProgressBar, Label } from '../ui/UIElement';

export class PreloadScene implements Scene {
    private stateManager: StateManager;
    private configLoader: ConfigLoader;
    private assetManager: AssetManager;
    private ui: UIManager;
    private progressBar!: ProgressBar;
    private label!: Label;
    private started: boolean = false;

    constructor(
        stateManager: StateManager,
        configLoader: ConfigLoader,
        assetManager: AssetManager,
        ui: UIManager
    ) {
        this.stateManager = stateManager;
        this.configLoader = configLoader;
        this.assetManager = assetManager;
        this.ui = ui;
    }

    enter(ctx: CanvasRenderingContext2D): void {
        this.ui.clear();
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        this.label = new Label({
            x: w / 2 - 150, y: h / 2 - 40,
            width: 300, height: 30,
            text: 'Loading assets...',
            fontSize: 20,
            color: '#a5b4fc',
            bold: true,
        });
        this.ui.addElement(this.label);

        this.progressBar = new ProgressBar({
            x: w / 2 - 150, y: h / 2,
            width: 300, height: 24,
            fillColor: '#818cf8',
            fillColorEnd: '#c084fc',
        });
        this.ui.addElement(this.progressBar);

        // Start loading assets
        this.started = true;
        const config = this.configLoader.getConfig();
        this.assetManager.loadImagesAndSounds(config.assets.images, config.assets.sounds).then(() => {
            // small delay for visual satisfaction
            setTimeout(() => {
                this.stateManager.changeState(GameState.Splash);
            }, 300);
        });
    }

    exit(): void {
        this.ui.clear();
    }

    update(_dt: number): void {
        if (this.started) {
            this.progressBar.progress = this.assetManager.progress;
            const pct = Math.round(this.assetManager.progress * 100);
            this.label.text = `Loading assets... ${pct}%`;
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0f0c29');
        grad.addColorStop(0.5, '#302b63');
        grad.addColorStop(1, '#24243e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        this.ui.render(ctx);
    }

    onPointer(event: GamePointerEvent): void {
        this.ui.handlePointer(event);
    }
}
