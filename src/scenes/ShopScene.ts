import { Scene, GameState, GamePointerEvent, ShopItem } from '../types/GameTypes';
import { StateManager } from '../core/StateManager';
import { ConfigLoader } from '../core/ConfigLoader';
import { SaveManager } from '../core/SaveManager';
import { UIManager } from '../ui/UIManager';
import { Button, Label, Panel, ScrollView } from '../ui/UIElement';

export class ShopScene implements Scene {
    private stateManager: StateManager;
    private configLoader: ConfigLoader;
    private saveManager: SaveManager;
    private ui: UIManager;
    private canvasW: number = 0;
    private canvasH: number = 0;
    private feedbackText: string = '';
    private feedbackTimer: number = 0;
    private feedbackColor: string = '#4ade80';
    private coinsLabel!: Label;
    private gemsLabel!: Label;
    public previousState: GameState = GameState.MainMenu;

    constructor(
        stateManager: StateManager,
        configLoader: ConfigLoader,
        saveManager: SaveManager,
        ui: UIManager
    ) {
        this.stateManager = stateManager;
        this.configLoader = configLoader;
        this.saveManager = saveManager;
        this.ui = ui;
    }

    enter(ctx: CanvasRenderingContext2D): void {
        this.ui.clear();
        this.canvasW = ctx.canvas.width;
        this.canvasH = ctx.canvas.height;
        this.feedbackText = '';
        this.feedbackTimer = 0;
        this.buildUI();
    }

    private buildUI(): void {
        const w = this.canvasW;
        const h = this.canvasH;
        const config = this.configLoader.getConfig();

        // Top bar
        const topPanel = new Panel({
            x: 0, y: 0, width: w, height: 60,
            bgColor: 'rgba(15, 12, 41, 0.9)',
            borderRadius: 0, borderWidth: 0,
        });
        this.ui.addElement(topPanel);

        // Title — positioned after back button, not centered
        const title = new Label({
            x: 90, y: 10, width: 180, height: 40,
            text: `🛒 ${this.configLoader.getText('powerUps')}`,
            fontSize: 20, color: '#c4b5fd', bold: true,
            align: 'left',
        });
        this.ui.addElement(title);

        // Back button
        const backBtn = new Button({
            x: 10, y: 12, width: 70, height: 36,
            text: '← BACK',
            fontSize: 13,
            bgColor: '#4a90d9',
            bgColorHover: '#5ba0e9',
            bgColorPressed: '#3a70b9',
            borderRadius: 8,
            onClick: () => {
                const nextState = this.previousState;
                this.previousState = GameState.MainMenu; // Reset to default
                this.stateManager.changeState(nextState);
            },
        });
        this.ui.addElement(backBtn);

        // Currency display — compact, right-aligned
        this.coinsLabel = new Label({
            x: w - 180, y: 10, width: 80, height: 40,
            text: `🪙${this.saveManager.getSoftCurrency()}`,
            fontSize: 14, color: '#fbbf24', bold: true,
            align: 'right',
        });
        this.ui.addElement(this.coinsLabel);

        this.gemsLabel = new Label({
            x: w - 90, y: 10, width: 80, height: 40,
            text: `💎${this.saveManager.getHardCurrency()}`,
            fontSize: 14, color: '#60a5fa', bold: true,
            align: 'right',
        });
        this.ui.addElement(this.gemsLabel);

        // Scrollable list of power-ups
        const scrollView = new ScrollView({
            x: 0, y: 70, width: w, height: h - 70,
            contentHeight: config.shop.powerUps.length * 120 + 40,
        });

        config.shop.powerUps.forEach((item, i) => {
            this.createShopCard(scrollView, item, i, w);
        });

        this.ui.addElement(scrollView);
    }

    private createShopCard(scroll: ScrollView, item: ShopItem, index: number, w: number): void {
        const cardY = 80 + index * 120;
        const cardX = 20;
        const cardW = w - 40;
        const cardH = 100;

        // Card background
        const card = new Panel({
            x: cardX, y: cardY, width: cardW, height: cardH,
            bgColor: 'rgba(30, 27, 75, 0.8)',
            borderColor: 'rgba(129, 140, 248, 0.3)',
            borderWidth: 1,
            borderRadius: 16,
        });
        scroll.addChild(card);

        // Icon
        const emojis: Record<string, string> = {
            skip: '⏭️',
            hint: '💡',
            fitForce: '🎯',
            slowTime: '⏳',
        };
        const iconLabel = new Label({
            x: cardX + 15, y: cardY + 15, width: 40, height: 40,
            text: emojis[item.id] || '🔧',
            fontSize: 30,
            align: 'center',
        });
        scroll.addChild(iconLabel);

        // Name
        const nameLabel = new Label({
            x: cardX + 65, y: cardY + 12, width: 160, height: 25,
            text: this.configLoader.getText(item.name),
            fontSize: 18, color: '#e0e7ff', bold: true,
            align: 'left',
        });
        scroll.addChild(nameLabel);

        // Description
        const descLabel = new Label({
            x: cardX + 65, y: cardY + 38, width: cardW - 180, height: 20,
            text: item.description,
            fontSize: 12, color: '#9ca3af',
            align: 'left',
        });
        scroll.addChild(descLabel);

        // Owned count
        const owned = this.saveManager.getPowerUpCount(item.id);
        const ownedLabel = new Label({
            x: cardX + 65, y: cardY + 60, width: 120, height: 20,
            text: `Owned: ${owned}`,
            fontSize: 13, color: '#a5b4fc',
            align: 'left',
        });
        scroll.addChild(ownedLabel);

        // Price + Buy button
        const currEmoji = item.currency === 'hard' ? '💎' : '🪙';
        const buyBtn = new Button({
            x: cardX + cardW - 120, y: cardY + 30,
            width: 105, height: 40,
            text: `${currEmoji} ${item.cost}`,
            fontSize: 15,
            bgColor: '#7c3aed',
            bgColorHover: '#8b5cf6',
            bgColorPressed: '#6d28d9',
            borderRadius: 10,
            onClick: () => {
                const success = item.currency === 'hard'
                    ? this.saveManager.spendHard(item.cost)
                    : this.saveManager.spendSoft(item.cost);

                if (success) {
                    this.saveManager.addPowerUp(item.id);
                    this.feedbackText = `✅ Purchased ${this.configLoader.getText(item.name)}!`;
                    this.feedbackColor = '#4ade80';
                    this.feedbackTimer = 2;
                    // Refresh UI
                    this.enter(document.querySelector('canvas')!.getContext('2d')!);
                } else {
                    this.feedbackText = this.configLoader.getText('notEnough');
                    this.feedbackColor = '#f87171';
                    this.feedbackTimer = 2;
                }
            },
        });
        scroll.addChild(buyBtn);
    }

    exit(): void {
        this.ui.clear();
    }

    update(dt: number): void {
        if (this.feedbackTimer > 0) {
            this.feedbackTimer -= dt;
        }
        this.ui.update(dt);
    }

    render(ctx: CanvasRenderingContext2D): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // Background
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#0f0c29');
        grad.addColorStop(0.5, '#1a1458');
        grad.addColorStop(1, '#24243e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        this.ui.render(ctx);

        // Feedback toast
        if (this.feedbackTimer > 0) {
            const alpha = Math.min(1, this.feedbackTimer);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            const tw = ctx.measureText(this.feedbackText).width + 40;
            const tx = (w - tw) / 2;
            const ty = h - 80;
            ctx.beginPath();
            ctx.roundRect(tx, ty, tw, 36, 10);
            ctx.fill();
            ctx.fillStyle = this.feedbackColor;
            ctx.font = '15px "Segoe UI", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.feedbackText, w / 2, ty + 18);
            ctx.restore();
        }
    }

    onPointer(event: GamePointerEvent): void {
        this.ui.handlePointer(event);
    }
}
