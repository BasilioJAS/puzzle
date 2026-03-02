import { Scene, GameState, GamePointerEvent, LevelConfig } from '../types/GameTypes';
import { StateManager } from '../core/StateManager';
import { ConfigLoader } from '../core/ConfigLoader';
import { AssetManager } from '../core/AssetManager';
import { SaveManager } from '../core/SaveManager';
import { UIManager } from '../ui/UIManager';
import { Button, Label, Panel, ScrollView } from '../ui/UIElement';

export class MapScene implements Scene {
    private stateManager: StateManager;
    private configLoader: ConfigLoader;
    private assetManager: AssetManager;
    private saveManager: SaveManager;
    private ui: UIManager;
    private scrollView!: ScrollView;
    private canvasW: number = 0;
    private canvasH: number = 0;
    private elapsed: number = 0;
    private nodeButtons: { btn: Button; levelId: number }[] = [];
    private isProbing: boolean = false;
    private popupElements: import('../ui/UIElement').UIElement[] = [];
    private overlayElements: import('../ui/UIElement').UIElement[] = [];

    // Callback set by Main.ts to pass level index to GameScene
    public onSelectLevel?: (level: LevelConfig) => void;
    public onOpenShop?: () => void;

    constructor(
        stateManager: StateManager,
        configLoader: ConfigLoader,
        assetManager: AssetManager,
        saveManager: SaveManager,
        ui: UIManager
    ) {
        this.stateManager = stateManager;
        this.configLoader = configLoader;
        this.assetManager = assetManager;
        this.saveManager = saveManager;
        this.ui = ui;
    }

    enter(ctx: CanvasRenderingContext2D): void {
        this.ui.clear();
        this.nodeButtons = [];
        this.canvasW = ctx.canvas.width;
        this.canvasH = ctx.canvas.height;
        this.elapsed = 0;

        const config = this.configLoader.getConfig();
        const settings = config.settings;

        this.buildHUD();
        this.buildMap();
    }

    private buildHUD(): void {
        const w = this.canvasW;

        // Top HUD panel
        const hudPanel = new Panel({
            x: 0, y: 0, width: w, height: 60,
            bgColor: 'rgba(15, 12, 41, 0.85)',
            borderRadius: 0,
            borderWidth: 0,
        });
        this.ui.addElement(hudPanel);

        // Bottom border glow
        const hudBorder = new Panel({
            x: 0, y: 58, width: w, height: 2,
            bgColor: 'rgba(129, 140, 248, 0.4)',
            borderRadius: 0,
            borderWidth: 0,
        });
        this.ui.addElement(hudBorder);

        // Combo
        const combo = this.saveManager.getCombo();
        const comboLabel = new Label({
            x: 15, y: 10, width: 80, height: 40,
            text: combo > 0 ? `🔥 x${combo}` : '🔥 —',
            fontSize: 18, color: combo > 0 ? '#f97316' : '#6b7280', bold: true,
            align: 'left',
        });
        this.ui.addElement(comboLabel);

        // Soft currency
        const coinsLabel = new Label({
            x: 100, y: 10, width: 100, height: 40,
            text: `🪙 ${this.saveManager.getSoftCurrency()}`,
            fontSize: 18, color: '#fbbf24', bold: true,
            align: 'left',
        });
        this.ui.addElement(coinsLabel);

        // Hard currency
        const gemsLabel = new Label({
            x: 210, y: 10, width: 100, height: 40,
            text: `💎 ${this.saveManager.getHardCurrency()}`,
            fontSize: 18, color: '#60a5fa', bold: true,
            align: 'left',
        });
        this.ui.addElement(gemsLabel);

        // Shop button
        const shopBtn = new Button({
            x: w - 110, y: 10, width: 100, height: 40,
            text: '🛒 SHOP',
            fontSize: 14,
            bgColor: '#7c3aed',
            bgColorHover: '#8b5cf6',
            bgColorPressed: '#6d28d9',
            borderRadius: 10,
            onClick: () => {
                if (this.onOpenShop) this.onOpenShop();
                this.stateManager.changeState(GameState.Shop);
            },
        });
        this.ui.addElement(shopBtn);
    }

    private buildMap(): void {
        const w = this.canvasW;
        const h = this.canvasH;
        const config = this.configLoader.getConfig();
        const levels = config.levels;
        const unlockedLevel = this.saveManager.getUnlockedLevel();

        const nodeSpacing = 110;
        const mapPadding = 80;
        const contentHeight = levels.length * nodeSpacing + mapPadding * 2;

        this.scrollView = new ScrollView({
            x: 0, y: 60, width: w, height: h - 60,
            contentHeight: contentHeight,
        });

        // Start scrolled to the current unlocked level
        const targetScroll = Math.max(0, (unlockedLevel - 1) * nodeSpacing - (h - 60) / 2 + mapPadding);
        this.scrollView.scrollY = Math.min(targetScroll, this.scrollView.maxScroll);

        // Build path and nodes
        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            const ny = mapPadding + i * nodeSpacing + 60; // +60 for scroll offset
            // Zigzag pattern
            const nx = w / 2 + Math.sin(i * 0.7) * (w * 0.2);

            const isUnlocked = level.id <= unlockedLevel;
            const isCompleted = this.saveManager.getStars(level.id) > 0;
            const isCurrent = level.id === unlockedLevel;

            const nodeSize = isCurrent ? 56 : 48;

            const btn = new Button({
                x: nx - nodeSize / 2,
                y: ny - nodeSize / 2,
                width: nodeSize,
                height: nodeSize,
                text: `${level.id}`,
                fontSize: isCurrent ? 20 : 16,
                bgColor: isCompleted
                    ? '#059669'
                    : isCurrent
                        ? '#7c3aed'
                        : isUnlocked
                            ? '#4a90d9'
                            : '#374151',
                bgColorHover: isCompleted
                    ? '#10b981'
                    : isCurrent
                        ? '#8b5cf6'
                        : isUnlocked
                            ? '#5ba0e9'
                            : '#374151',
                bgColorPressed: isCompleted
                    ? '#047857'
                    : isCurrent
                        ? '#6d28d9'
                        : isUnlocked
                            ? '#3a70b9'
                            : '#374151',
                borderColor: isCurrent
                    ? '#c4b5fd'
                    : isCompleted
                        ? '#6ee7b7'
                        : 'rgba(255,255,255,0.15)',
                borderWidth: isCurrent ? 3 : 1,
                borderRadius: nodeSize / 2,
                textColor: isUnlocked ? '#ffffff' : '#6b7280',
                onClick: () => {
                    if (isUnlocked && !this.isProbing && this.popupElements.length === 0) {
                        this.probeAndLoadLevel(level);
                    }
                },
            });

            this.scrollView.addChild(btn);
            this.nodeButtons.push({ btn, levelId: level.id });

            // Stars below completed levels
            if (isCompleted) {
                const stars = this.saveManager.getStars(level.id);
                const starStr = '⭐'.repeat(stars);
                const starLabel = new Label({
                    x: nx - 40, y: ny + nodeSize / 2 + 4,
                    width: 80, height: 20,
                    text: starStr,
                    fontSize: 12,
                    color: '#fbbf24',
                });
                this.scrollView.addChild(starLabel);
            }

            // "LOCKED" text for locked levels
            if (!isUnlocked) {
                const lockLabel = new Label({
                    x: nx - 30, y: ny + nodeSize / 2 + 4,
                    width: 60, height: 18,
                    text: '🔒',
                    fontSize: 12,
                    color: '#6b7280',
                });
                this.scrollView.addChild(lockLabel);
            }
        }

        this.ui.addElement(this.scrollView);
    }

    private async probeAndLoadLevel(level: LevelConfig) {
        this.isProbing = true;
        // Create a simple loading overlay
        const overlay = new Panel({
            x: 0, y: 0, width: this.canvasW, height: this.canvasH,
            bgColor: 'rgba(0,0,0,0.85)', borderRadius: 0
        });
        const lbl = new Label({
            x: 0, y: this.canvasH / 2 - 20, width: this.canvasW, height: 40,
            text: 'Loading level data...', color: 'white', fontSize: 24, bold: true
        });

        this.overlayElements = [overlay, lbl];
        this.overlayElements.forEach(el => this.ui.addElement(el));

        try {
            const baseUrl = import.meta.env.BASE_URL;
            // 1. Check if level exists at all (file piece_0_0.png)
            const firstUrl = `${baseUrl}assets/levels/${level.id}/piece_0_0.png`;
            const firstRes = await fetch(firstUrl, { method: 'HEAD' });

            const isImage = (r: Response) => r.ok && r.headers.get('content-type')?.includes('image');

            if (!isImage(firstRes)) {
                throw new Error("Level files missing");
            }

            // 2. Discover columns (iterate c until 404 or non-image)
            let c = 1;
            while (true) {
                const url = `${baseUrl}assets/levels/${level.id}/piece_0_${c}.png`;
                const res = await fetch(url, { method: 'HEAD' });
                if (!isImage(res)) break;
                c++;
            }
            level.cols = c;

            // 3. Discover rows (iterate r until 404 or non-image)
            let r = 1;
            while (true) {
                const url = `${baseUrl}assets/levels/${level.id}/piece_${r}_0.png`;
                const res = await fetch(url, { method: 'HEAD' });
                if (!isImage(res)) break;
                r++;
            }
            level.rows = r;

            level.pieces = level.cols * level.rows;
            level.piecesFolder = `assets/levels/${level.id}/`;

            this.overlayElements.forEach(el => this.ui.removeElement(el));
            this.overlayElements = [];
            this.isProbing = false;

            if (this.onSelectLevel) this.onSelectLevel(level);
            this.stateManager.changeState(GameState.Gameplay);

        } catch (e) {
            console.error("Probing failed:", e);
            this.overlayElements.forEach(el => this.ui.removeElement(el));
            this.overlayElements = [];
            this.isProbing = false;
            this.showErrorPopup(level.id);
        }
    }

    private showErrorPopup(levelId: number) {
        if (this.popupElements.length > 0) return;

        const w = 300;
        const h = 200;
        const panel = new Panel({
            x: this.canvasW / 2 - w / 2,
            y: this.canvasH / 2 - h / 2,
            width: w,
            height: h,
            bgColor: '#1f2937',
            borderColor: '#374151',
            borderRadius: 12,
            borderWidth: 2
        });

        const titleParams = {
            x: panel.x, y: panel.y + 30, width: w, height: 30,
            text: 'ERROR', fontSize: 24, color: '#ef4444', bold: true
        };
        const titleLabel = new Label(titleParams);

        // Sin "wrap" property, achicamos un poco la font
        const msgParams = {
            x: panel.x + 20, y: panel.y + 80, width: w - 40, height: 60,
            text: `Data for level ${levelId} is missing...`,
            fontSize: 14, color: '#d1d5db'
        };
        const msgLabel = new Label(msgParams);

        const closeBtn = new Button({
            x: panel.x + w / 2 - 50, y: panel.y + 140, width: 100, height: 40,
            text: 'CLOSE', bgColor: '#4b5563', bgColorHover: '#6b7280',
            onClick: () => {
                this.popupElements.forEach(el => this.ui.removeElement(el));
                this.popupElements = [];
            }
        });

        this.popupElements = [panel, titleLabel, msgLabel, closeBtn];
        this.popupElements.forEach(el => this.ui.addElement(el));
    }

    exit(): void {
        this.ui.clear();
    }

    update(dt: number): void {
        this.elapsed += dt;
        this.ui.update(dt);
    }

    render(ctx: CanvasRenderingContext2D): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Background gradient
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0f0c29');
        grad.addColorStop(0.3, '#1a1458');
        grad.addColorStop(0.6, '#302b63');
        grad.addColorStop(1, '#24243e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Decorative stars in background
        ctx.save();
        for (let i = 0; i < 50; i++) {
            const sx = (i * 73.737) % w;
            const sy = (i * 53.37) % h;
            const alpha = 0.05 + 0.1 * Math.sin(this.elapsed + i * 0.5);
            ctx.fillStyle = `rgba(200, 200, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 1 + (i % 2), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Draw path lines connecting nodes inside scroll view
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.scrollView.x, this.scrollView.y, this.scrollView.width, this.scrollView.height);
        ctx.clip();
        ctx.translate(0, -this.scrollView.scrollY);

        // Draw zigzag path lines
        ctx.strokeStyle = 'rgba(129, 140, 248, 0.3)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        for (let i = 0; i < this.nodeButtons.length; i++) {
            const btn = this.nodeButtons[i].btn;
            const cx = btn.x + btn.width / 2;
            const cy = btn.y + btn.height / 2;
            if (i === 0) ctx.moveTo(cx, cy);
            else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // UI draws scroll view with nodes
        this.ui.render(ctx);
    }

    onPointer(event: GamePointerEvent): void {
        this.ui.handlePointer(event);
    }
}
