import { GamePointerEvent, GameState } from '../types/GameTypes';
import { SaveManager } from '../core/SaveManager';
import { Button, Label, Panel } from './UIElement';
import pkg from '../../package.json';

const APP_VERSION: string = pkg.version;

/**
 * CheatMenu — always-on debug overlay rendered on top of everything.
 * Toggle with a small 🐛 button.
 */
export class CheatMenu {
    private visible: boolean = false;
    private toggleBtn: Button;
    private panel: Panel;
    private buttons: Button[] = [];
    private allElements: (Button | Panel | Label)[] = [];

    // References set by Main.ts
    private saveManager!: SaveManager;
    private onSkipTime?: () => void;
    private onPassLevel?: () => void;
    private onAddGold?: () => void;
    private onAddGems?: () => void;
    private onReset?: () => void;
    private onToggleShowId?: () => void;

    constructor() {
        // Toggle button — always visible in top-left
        this.toggleBtn = new Button({
            x: 4, y: 4, width: 32, height: 24,
            text: '🐛',
            fontSize: 12,
            bgColor: 'rgba(50,50,50,0.6)',
            bgColorHover: 'rgba(80,80,80,0.8)',
            bgColorPressed: 'rgba(30,30,30,0.8)',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            onClick: () => {
                this.visible = !this.visible;
            },
        });

        // Panel background
        this.panel = new Panel({
            x: 4, y: 32, width: 160, height: 286,
            bgColor: 'rgba(10, 8, 30, 0.92)',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 12,
        });

        const btnOpts = {
            width: 144, height: 34,
            fontSize: 12,
            borderRadius: 8,
            borderWidth: 1,
        };

        const makeBtn = (y: number, text: string, color: string, hoverColor: string, pressColor: string, cb: () => void) => {
            return new Button({
                x: 12, y,
                ...btnOpts,
                text,
                bgColor: color,
                bgColorHover: hoverColor,
                bgColorPressed: pressColor,
                onClick: cb,
            });
        };

        this.buttons = [
            makeBtn(44, '⏩ Skip 90% Time', '#b45309', '#d97706', '#92400e', () => this.onSkipTime?.()),
            makeBtn(86, '🪙 +1000 Gold', '#ca8a04', '#eab308', '#a16207', () => this.onAddGold?.()),
            makeBtn(128, '💎 +100 Gems', '#2563eb', '#3b82f6', '#1d4ed8', () => this.onAddGems?.()),
            makeBtn(170, '⏭️ Pass Level', '#059669', '#10b981', '#047857', () => this.onPassLevel?.()),
            makeBtn(212, '👁️ Toggle ID', '#8b5cf6', '#a78bfa', '#7c3aed', () => this.onToggleShowId?.()),
            makeBtn(254, '🗑️ Reset Save', '#dc2626', '#ef4444', '#b91c1c', () => this.onReset?.()),
        ];

        // Title
        const title = new Label({
            x: 12, y: 32, width: 144, height: 14,
            text: 'CHEATS',
            fontSize: 10,
            color: '#f59e0b',
            bold: true,
        });

        // Version label
        const versionLabel = new Label({
            x: 12, y: 44, width: 144, height: 10,
            text: `v${APP_VERSION}`,
            fontSize: 9,
            color: 'rgba(245,158,11,0.5)',
            bold: false,
        });

        this.allElements = [this.panel, title, versionLabel, ...this.buttons];
    }

    configure(opts: {
        saveManager: SaveManager;
        onSkipTime: () => void;
        onPassLevel: () => void;
        onReset: () => void;
        onToggleShowId: () => void;
    }): void {
        this.saveManager = opts.saveManager;
        this.onSkipTime = opts.onSkipTime;
        this.onPassLevel = opts.onPassLevel;
        this.onReset = opts.onReset;
        this.onToggleShowId = opts.onToggleShowId;
        this.onAddGold = () => {
            this.saveManager.addSoftCurrency(1000);
        };
        this.onAddGems = () => {
            this.saveManager.addHardCurrency(100);
        };
    }

    handlePointer(event: GamePointerEvent): boolean {
        // Toggle button always active
        if (event.type === 'down' && this.toggleBtn.containsPoint(event.x, event.y)) {
            this.toggleBtn.isPressed = true;
            return true;
        }
        if (event.type === 'move') {
            this.toggleBtn.isHover = this.toggleBtn.containsPoint(event.x, event.y);
        }
        if (event.type === 'up' && this.toggleBtn.isPressed) {
            this.toggleBtn.isPressed = false;
            if (this.toggleBtn.containsPoint(event.x, event.y)) {
                this.toggleBtn.onClick?.();
            }
            return true;
        }

        if (!this.visible) return false;

        // Check panel buttons
        for (const btn of this.buttons) {
            if (event.type === 'down' && btn.containsPoint(event.x, event.y)) {
                btn.isPressed = true;
                return true;
            }
            if (event.type === 'move') {
                btn.isHover = btn.containsPoint(event.x, event.y);
                if (!btn.isHover) btn.isPressed = false;
            }
            if (event.type === 'up') {
                if (btn.isPressed && btn.containsPoint(event.x, event.y)) {
                    btn.isPressed = false;
                    btn.onClick?.();
                    return true;
                }
                btn.isPressed = false;
            }
        }

        // Consume clicks inside the panel area
        if (this.panel.containsPoint(event.x, event.y)) return true;

        return false;
    }

    update(dt: number): void {
        this.toggleBtn.update(dt);
        for (const btn of this.buttons) {
            btn.update(dt);
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        // Toggle button always rendered
        this.toggleBtn.draw(ctx);

        if (!this.visible) return;

        for (const el of this.allElements) {
            el.draw(ctx);
        }
    }
}
