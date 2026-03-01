import { Scene, GameState, GamePointerEvent, LevelConfig, PuzzlePiece, OrientationLayout } from '../types/GameTypes';
import { StateManager } from '../core/StateManager';
import { ConfigLoader } from '../core/ConfigLoader';
import { AssetManager } from '../core/AssetManager';
import { SaveManager } from '../core/SaveManager';
import { UIManager } from '../ui/UIManager';
import { Button, Label, Panel } from '../ui/UIElement';

interface StarParticle {
    x: number; y: number;
    vx: number; vy: number;
    size: number;
    rotation: number;
    rotSpeed: number;
    alpha: number;
    color: string;
    life: number;
    maxLife: number;
}

export class GameScene implements Scene {
    private stateManager: StateManager;
    private configLoader: ConfigLoader;
    private assetManager: AssetManager;
    private saveManager: SaveManager;
    private ui: UIManager;
    private ctx!: CanvasRenderingContext2D;

    // Level state
    private level: LevelConfig | null = null;
    private pieces: PuzzlePiece[] = [];
    private timeRemaining: number = 0;
    private isSlowTime: boolean = false;
    private slowTimeRemaining: number = 0;
    private canvasW: number = 0;
    private canvasH: number = 0;
    private elapsed: number = 0;
    private isLandscape: boolean = false;

    // Grid layout (computed from JSON layout)
    private gridX: number = 0;
    private gridY: number = 0;
    private gridW: number = 0;
    private gridH: number = 0;
    private cellSize: number = 0; // square cells

    // Dragging
    // Dragging
    private dragPiece: PuzzlePiece | null = null;
    private dragOffX: number = 0;
    private dragOffY: number = 0;
    private dragFromGridCol: number = -1;  // grid col piece was sitting on
    private dragFromGridRow: number = -1;  // grid row piece was sitting on

    // Fit Force mode
    private fitForceMode: boolean = false;
    private fitForceLabel: Label | null = null;
    private usedFitForce: boolean = false;

    // Hint
    private hintPiece: PuzzlePiece | null = null;
    private hintTimer: number = 0;

    // Game over / win
    private gameEnded: boolean = false;
    private pausedForShop: boolean = false;

    // Celebration state
    private celebrating: boolean = false;
    private celebrationTimer: number = 0;
    private celebrationStars: number = 0;
    private starParticles: StarParticle[] = [];
    private celebrationAlpha: number = 0;

    // UI refs
    private timerLabel!: Label;

    // Debug
    private showId: boolean = false;

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

    setLevel(level: LevelConfig): void {
        this.level = level;
    }

    // ─── Public methods for CheatMenu ───
    skipTime(): void {
        if (this.level && !this.gameEnded) {
            const skipAmount = this.level.timeLimit * 0.9;
            this.timeRemaining = Math.max(0, this.timeRemaining - skipAmount);
        }
    }

    toggleShowId(): void {
        this.showId = !this.showId;
    }

    triggerWin(): void {
        if (this.level && !this.gameEnded) {
            for (const p of this.pieces) {
                p.placed = true;
                p.x = p.targetX;
                p.y = p.targetY;
                p.width = this.cellSize;
                p.height = this.cellSize;
            }
            this.winLevel();
        }
    }

    enter(ctx: CanvasRenderingContext2D): void {
        this.ctx = ctx;
        if (this.pausedForShop) {
            this.pausedForShop = false;
            this.ui.clear();
            this.buildUI();
            return;
        }

        this.ui.clear();
        this.canvasW = ctx.canvas.width;
        this.canvasH = ctx.canvas.height;
        this.isLandscape = this.canvasW > this.canvasH;
        this.elapsed = 0;
        this.gameEnded = false;
        this.dragPiece = null;
        this.hintPiece = null;
        this.hintTimer = 0;
        this.isSlowTime = false;
        this.slowTimeRemaining = 0;
        this.fitForceMode = false;
        this.fitForceLabel = null;
        this.usedFitForce = false;
        this.celebrating = false;

        if (!this.level) return;
        this.timeRemaining = this.level.timeLimit;

        this.buildLayout();
        this.buildPieces();
        this.buildUI();
    }

    private getLayout(): OrientationLayout {
        const config = this.configLoader.getConfig();
        const layout = config.layout;
        if (layout) {
            return this.isLandscape ? layout.landscape : layout.portrait;
        }
        // Fallback defaults
        if (this.isLandscape) {
            return {
                topBar: { x: 0, y: 0, w: 1.0, h: 50 },
                grid: { x: 0.1, y: 0.12, w: 0.8, h: 0.85 },
                tray: { x: 0, y: 0, w: 0, h: 0 },
                trayDirection: 'grid',
                powerUps: { x: 0.92, y: 0.12, w: 40, h: 200 },
            };
        }
        return {
            topBar: { x: 0, y: 0, w: 1.0, h: 60 },
            grid: { x: 0.05, y: 0.15, w: 0.9, h: 0.7 },
            tray: { x: 0, y: 0, w: 0, h: 0 },
            trayDirection: 'horizontal',
            powerUps: { x: 0.88, y: 0.15, w: 50, h: 220 },
        };
    }

    private resolveRect(rect: { x: number; y: number; w: number; h: number }) {
        return {
            x: rect.x <= 1 ? Math.round(rect.x * this.canvasW) : rect.x,
            y: rect.y <= 1 ? Math.round(rect.y * this.canvasH) : rect.y,
            w: rect.w <= 1 ? Math.round(rect.w * this.canvasW) : rect.w,
            h: rect.h <= 1 ? Math.round(rect.h * this.canvasH) : rect.h,
        };
    }

    private buildLayout(): void {
        if (!this.level) return;
        const layout = this.getLayout();
        const gridRect = this.resolveRect(layout.grid);

        const n = this.level.cols;
        const maxCellFromW = Math.floor(gridRect.w / n);
        const maxCellFromH = Math.floor(gridRect.h / n);
        this.cellSize = Math.min(maxCellFromW, maxCellFromH);

        this.gridW = this.cellSize * n;
        this.gridH = this.cellSize * n;
        this.gridX = gridRect.x + (gridRect.w - this.gridW) / 2;
        this.gridY = gridRect.y + (gridRect.h - this.gridH) / 2;
    }

    private createPiece(id: number, c: number, r: number, cols: number, _rows: number, imgW: number, imgH: number): PuzzlePiece {
        return {
            id,
            col: c,
            row: r,
            x: 0,
            y: 0,
            targetX: this.gridX + c * this.cellSize,
            targetY: this.gridY + r * this.cellSize,
            width: this.cellSize,
            height: this.cellSize,
            placed: false,
            dragging: false,
            sx: (c / cols) * imgW,
            sy: (r / cols) * imgH,
            sw: imgW / cols,
            sh: imgH / cols,
            animScale: 1,
            animScaleTarget: 1,
            animRotation: 0,
            animOffsetY: 0,
            dragVelX: 0,
            dragVelY: 0,
            snapAnim: 0,
            prevX: 0,
            prevY: 0,
        };
    }

    private buildPieces(): void {
        if (!this.level) return;

        this.pieces = [];
        const { cols, rows } = this.level;
        const image = this.assetManager.getImage(this.level.image);
        const imgW = image?.naturalWidth ?? 256;
        const imgH = image?.naturalHeight ?? 256;

        let id = 0;
        const positions: { c: number, r: number }[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                positions.push({ c, r });
                this.pieces.push(this.createPiece(id++, c, r, cols, rows, imgW, imgH));
            }
        }

        let shuffledPos = [...positions];
        let isValidDerangement = false;

        while (!isValidDerangement) {
            // Fisher-Yates shuffle
            for (let i = shuffledPos.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledPos[i], shuffledPos[j]] = [shuffledPos[j], shuffledPos[i]];
            }
            // Check if any element is in its original position (no fixed points)
            isValidDerangement = shuffledPos.every((pos, i) => pos.c !== positions[i].c || pos.r !== positions[i].r);
        }

        this.pieces.forEach((p, i) => {
            const pos = shuffledPos[i];
            p.x = this.gridX + pos.c * this.cellSize;
            p.y = this.gridY + pos.r * this.cellSize;
        });
    }

    private buildUI(): void {
        this.ui.clear();

        const w = this.canvasW;
        const layout = this.getLayout();
        const topBar = this.resolveRect(layout.topBar);

        const topPanel = new Panel({
            x: topBar.x, y: topBar.y, width: topBar.w, height: topBar.h,
            bgColor: 'rgba(255, 255, 255, 0.0)',
            borderRadius: 0,
            borderWidth: 0,
        });
        this.ui.addElement(topPanel);

        const levelLabel = new Label({
            x: 15, y: 8, width: 150, height: topBar.h - 16,
            text: `⭐ Level ${this.level?.id ?? 1}`,
            fontSize: this.isLandscape ? 16 : 20, color: '#7c3aed', bold: true,
            align: 'left',
        });
        this.ui.addElement(levelLabel);

        this.timerLabel = new Label({
            x: w / 2 - 60, y: 8, width: 120, height: topBar.h - 16,
            text: this.formatTime(this.timeRemaining),
            fontSize: this.isLandscape ? 20 : 24, color: '#f97316', bold: true,
        });
        this.ui.addElement(this.timerLabel);

        const puLayout = this.resolveRect(layout.powerUps);
        const powerBtnSize = this.isLandscape ? 38 : 44;
        const powerBtnGap = 8;

        const powers = [
            { id: 'skip', emoji: '⏭️', color: '#ef4444', hoverColor: '#f87171', pressColor: '#dc2626', action: () => this.useSkip() },
            { id: 'hint', emoji: '💡', color: '#f59e0b', hoverColor: '#fbbf24', pressColor: '#d97706', action: () => this.useHint() },
            { id: 'fitForce', emoji: '🎯', color: '#ec4899', hoverColor: '#f472b6', pressColor: '#db2777', action: () => this.useFitForce() },
            { id: 'slowTime', emoji: '⏳', color: '#3b82f6', hoverColor: '#60a5fa', pressColor: '#2563eb', action: () => this.useSlowTime() },
        ];

        const exitBtn = new Button({
            x: puLayout.x,
            y: puLayout.y,
            width: powerBtnSize,
            height: powerBtnSize,
            text: '✕',
            fontSize: 18,
            bgColor: '#ef4444',
            bgColorHover: '#f87171',
            bgColorPressed: '#dc2626',
            borderRadius: powerBtnSize / 2,
            onClick: () => this.stateManager.changeState(GameState.MainMenu),
        });
        this.ui.addElement(exitBtn);

        const puStartIdx = 1;
        const puPowers = powers;
        puPowers.forEach((p, i) => {
            const count = this.saveManager.getPowerUpCount(p.id);
            const yPos = puLayout.y + (puStartIdx + i) * (powerBtnSize + powerBtnGap);
            const btn = new Button({
                x: puLayout.x,
                y: yPos,
                width: powerBtnSize,
                height: powerBtnSize,
                text: p.emoji,
                fontSize: this.isLandscape ? 16 : 20,
                bgColor: count > 0 ? p.color : '#d1d5db',
                bgColorHover: count > 0 ? p.hoverColor : '#e5e7eb',
                bgColorPressed: count > 0 ? p.pressColor : '#d1d5db',
                borderRadius: powerBtnSize / 2,
                onClick: () => { if (count > 0) p.action(); },
            });
            this.ui.addElement(btn);

            if (count > 0) {
                const badge = new Label({
                    x: puLayout.x + powerBtnSize - 14,
                    y: yPos - 4,
                    width: 18, height: 14,
                    text: `${count}`,
                    fontSize: 10,
                    color: '#7c3aed',
                    bold: true,
                });
                this.ui.addElement(badge);
            }
        });

        // Restore dynamic overlay label if any
        if (this.fitForceLabel) {
            this.ui.addElement(this.fitForceLabel);
        }

        const shopBtn = new Button({
            x: puLayout.x,
            y: puLayout.y + (puStartIdx + puPowers.length) * (powerBtnSize + powerBtnGap),
            width: powerBtnSize,
            height: powerBtnSize,
            text: '🛒',
            fontSize: this.isLandscape ? 16 : 20,
            bgColor: '#8b5cf6',
            bgColorHover: '#a78bfa',
            bgColorPressed: '#7c3aed',
            borderRadius: powerBtnSize / 2,
            onClick: () => this.goToShop(),
        });
        this.ui.addElement(shopBtn);
    }

    private formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    private findGridCellAt(x: number, y: number): { col: number; row: number } | null {
        const col = Math.floor((x - this.gridX) / this.cellSize);
        const row = Math.floor((y - this.gridY) / this.cellSize);
        if (this.level && col >= 0 && col < this.level.cols && row >= 0 && row < this.level.rows) {
            return { col, row };
        }
        return null;
    }

    private findPieceOnGridAt(col: number, row: number): PuzzlePiece | null {
        return this.pieces.find(p => {
            if (p.dragging || p.placed) return false;
            const pCol = Math.round((p.x - this.gridX) / this.cellSize);
            const pRow = Math.round((p.y - this.gridY) / this.cellSize);
            return pCol === col && pRow === row;
        }) || null;
    }

    private findUnlockedPieceOnCell(col: number, row: number, exclude?: PuzzlePiece): PuzzlePiece | null {
        return this.pieces.find(p => {
            if (p === exclude) return false;
            if (p.placed) return false;
            const pCol = Math.round((p.x - this.gridX) / this.cellSize);
            const pRow = Math.round((p.y - this.gridY) / this.cellSize);
            return pCol === col && pRow === row;
        }) || null;
    }

    private findLockedPieceOnCell(col: number, row: number): PuzzlePiece | null {
        return this.pieces.find(p => p.placed && p.col === col && p.row === row) || null;
    }

    private placePieceOnCell(piece: PuzzlePiece, col: number, row: number): void {
        piece.x = this.gridX + col * this.cellSize;
        piece.y = this.gridY + row * this.cellSize;
        piece.width = this.cellSize;
        piece.height = this.cellSize;
        piece.snapAnim = 1;
    }

    private placePieceAt(piece: PuzzlePiece, col: number, row: number): void {
        if (piece.col === col && piece.row === row) {
            this.placePieceLocked(piece);
        } else {
            this.placePieceOnCell(piece, col, row);
        }
    }

    private placePieceLocked(piece: PuzzlePiece): void {
        piece.placed = true;
        piece.x = piece.targetX;
        piece.y = piece.targetY;
        piece.width = this.cellSize;
        piece.height = this.cellSize;
        piece.snapAnim = 1;
        this.assetManager.playSound('snap');
        this.checkWin();
    }

    private checkWin(): void {
        if (this.pieces.every(p => p.placed)) {
            this.winLevel();
        }
    }

    private winLevel(): void {
        if (this.gameEnded) return;
        this.gameEnded = true;
        this.celebrating = true;
        this.celebrationTimer = 0;
        this.celebrationStars = this.calculateStars();
        this.saveManager.completeLevel(this.level!.id, this.celebrationStars);
        this.saveManager.addSoftCurrency(this.celebrationStars * 10);
        this.assetManager.playSound('win');
    }

    private calculateStars(): number {
        if (this.usedFitForce) return 1;
        const config = this.configLoader.getConfig();
        const settings = config.settings;
        const pctRemaining = this.timeRemaining / this.level!.timeLimit;
        if (pctRemaining >= (settings?.star3Pct ?? 0.5)) return 3;
        if (pctRemaining >= (settings?.star2Pct ?? 0.2)) return 2;
        return 1;
    }

    private loseLevel(): void {
        if (this.gameEnded) return;
        this.gameEnded = true;
        this.assetManager.playSound('lose');
        this.showLoseOverlay();
    }

    private showLoseOverlay(): void {
        const w = this.canvasW;
        const h = this.canvasH;
        const overlay = new Panel({
            x: 0, y: 0, width: w, height: h,
            bgColor: 'rgba(0,0,0,0.8)',
        });
        this.ui.addElement(overlay);

        const modalW = Math.min(w * 0.8, 300);
        const modalH = 200;
        const modal = new Panel({
            x: (w - modalW) / 2, y: (h - modalH) / 2, width: modalW, height: modalH,
            bgColor: '#1f2937', borderRadius: 16, borderWidth: 2, borderColor: '#374151'
        });
        this.ui.addElement(modal);

        this.ui.addElement(new Label({
            x: (w - modalW) / 2, y: (h - modalH) / 2 + 40, width: modalW, height: 40,
            text: 'Time\'s Up!', fontSize: 32, color: '#ef4444', bold: true
        }));

        this.ui.addElement(new Button({
            x: (w - 140) / 2, y: (h - modalH) / 2 + 110, width: 140, height: 45,
            text: 'Try Again', bgColor: '#4a90d9', borderRadius: 12,
            onClick: () => this.enter(this.ctx)
        }));
    }

    exit(): void {
        this.exitFitForceMode();
        this.ui.clear();
    }

    update(dt: number): void {
        this.ui.update(dt);

        if (this.celebrating) {
            this.celebrationTimer += dt;
            this.celebrationAlpha = Math.min(1, this.celebrationTimer * 2);
            for (const p of this.starParticles) {
                p.x += p.vx * dt; p.y += p.vy * dt;
                p.vy += 30 * dt; p.rotation += p.rotSpeed * dt;
                p.life -= dt; p.alpha = Math.max(0, p.life / p.maxLife);
            }
            this.starParticles = this.starParticles.filter(p => p.life > 0);
            if (this.celebrationTimer < 3.5) {
                for (let i = 0; i < 2; i++) this.spawnStarParticle();
            }
            if (this.celebrationTimer >= 4) this.endCelebration();
            return;
        }

        if (this.gameEnded) return;

        this.elapsed += dt;
        const rate = this.isSlowTime ? 0.5 : 1;
        this.timeRemaining -= dt * rate;

        if (this.isSlowTime) {
            this.slowTimeRemaining -= dt;
            if (this.slowTimeRemaining <= 0) this.isSlowTime = false;
        }

        if (this.timeRemaining <= 0) {
            this.timeRemaining = 0;
            this.loseLevel();
        }

        this.timerLabel.text = this.formatTime(this.timeRemaining);
        this.timerLabel.color = this.timeRemaining < 10 ? '#ef4444' : this.isSlowTime ? '#60a5fa' : '#f97316';

        if (this.hintTimer > 0) {
            this.hintTimer -= dt;
            if (this.hintTimer <= 0) this.hintPiece = null;
        }

        for (const p of this.pieces) {
            p.animScale += (p.animScaleTarget - p.animScale) * Math.min(1, dt * 10);
            if (p.snapAnim > 0) {
                p.snapAnim -= dt * 3;
                if (p.snapAnim < 0) p.snapAnim = 0;
            }
            p.animRotation *= 0.9;
            if (!p.dragging) {
                p.dragVelX *= 0.85;
                p.dragVelY *= 0.85;
                p.animOffsetY *= 0.85;
            }
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#fef3e2');
        grad.addColorStop(0.5, '#fde8cd');
        grad.addColorStop(1, '#e8dff5');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#ffffff';
        const cloudY1 = 40 + Math.sin(this.elapsed * 0.3) * 5;
        const cloudY2 = 100 + Math.sin(this.elapsed * 0.2 + 2) * 4;
        this.drawCloud(ctx, 50, cloudY1, 60);
        this.drawCloud(ctx, w - 80, cloudY2, 45);
        this.drawCloud(ctx, w / 2 + 60, 30 + Math.sin(this.elapsed * 0.25 + 1) * 3, 35);
        ctx.restore();

        if (this.celebrating && this.level) {
            this.renderCelebration(ctx, w, h);
            return;
        }

        if (!this.gameEnded && this.level) {
            this.drawGrid(ctx);

            const sorted = [...this.pieces].sort((a, b) => {
                if (a.dragging) return 1;
                if (b.dragging) return -1;
                if (a.placed && !b.placed) return -1;
                return 0;
            });

            for (const piece of sorted) this.drawPiece(ctx, piece);

            if (this.hintPiece && this.hintTimer > 0) {
                const alpha = 0.3 + 0.3 * Math.sin(this.elapsed * 6);
                ctx.fillStyle = `rgba(250, 204, 21, ${alpha})`;
                ctx.fillRect(this.hintPiece.targetX, this.hintPiece.targetY, this.cellSize, this.cellSize);
                ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
                ctx.strokeRect(this.hintPiece.targetX, this.hintPiece.targetY, this.cellSize, this.cellSize);
                ctx.strokeStyle = `rgba(74, 222, 128, ${0.5 + 0.5 * Math.sin(this.elapsed * 6)})`;
                ctx.strokeRect(this.hintPiece.x - 2, this.hintPiece.y - 2, this.hintPiece.width + 4, this.hintPiece.height + 4);
            }

            if (this.fitForceMode) {
                const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 5);
                ctx.fillStyle = `rgba(236, 72, 153, ${pulse * 0.2})`; // Light pink overlay on grid
                ctx.fillRect(this.gridX, this.gridY, this.gridW, this.gridH);
            }
        }
        this.ui.render(ctx);
    }

    private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
        ctx.arc(x + size * 0.8, y, size * 0.35, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y + size * 0.1, size * 0.45, 0, Math.PI * 2);
        ctx.fill();
    }

    private drawGrid(ctx: CanvasRenderingContext2D): void {
        const n = this.level!.cols;
        const r = 12;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(this.gridX - 2, this.gridY - 2, this.gridW + 4, this.gridH + 4, r);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = 'rgba(147, 197, 253, 0.6)';
        ctx.lineWidth = 1.5;
        for (let i = 1; i < n; i++) {
            const y = this.gridY + i * this.cellSize;
            ctx.beginPath(); ctx.moveTo(this.gridX + 4, y); ctx.lineTo(this.gridX + this.gridW - 4, y); ctx.stroke();
            const x = this.gridX + i * this.cellSize;
            ctx.beginPath(); ctx.moveTo(x, this.gridY + 4); ctx.lineTo(x, this.gridY + this.gridH - 4); ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(this.gridX - 2, this.gridY - 2, this.gridW + 4, this.gridH + 4, r);
        ctx.stroke();

        if (this.showId) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let id = 0;
            for (let r = 0; r < this.level!.rows; r++) {
                for (let c = 0; c < n; c++) {
                    const cx = this.gridX + c * this.cellSize + this.cellSize / 2;
                    const cy = this.gridY + r * this.cellSize + this.cellSize / 2;
                    ctx.fillText(`${id++}`, cx, cy);
                }
            }
        }
    }

    private drawPiece(ctx: CanvasRenderingContext2D, piece: PuzzlePiece): void {
        const image = this.assetManager.getImage(this.level!.image);
        ctx.save();
        const cx = piece.x + piece.width / 2;
        const cy = piece.y + piece.height / 2;
        const scale = piece.animScale;
        const rotation = piece.animRotation;
        const liftY = piece.animOffsetY;

        ctx.translate(cx, cy - liftY);
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        if (piece.dragging) {
            const skewX = Math.max(-0.15, Math.min(0.15, piece.dragVelX * 0.003));
            const skewY = Math.max(-0.1, Math.min(0.1, piece.dragVelY * 0.002));
            ctx.transform(1, skewY, skewX, 1, 0, 0);
        }
        ctx.translate(-cx, -cy);

        if (piece.dragging) {
            ctx.shadowColor = 'rgba(251, 146, 60, 0.5)';
            ctx.shadowBlur = 12 + liftY;
            ctx.shadowOffsetY = 4 + liftY * 0.5;
        }
        if (piece.snapAnim > 0) {
            ctx.shadowColor = `rgba(74, 222, 128, ${piece.snapAnim * 0.8})`;
            ctx.shadowBlur = 15 * piece.snapAnim;
        }

        const settings = this.configLoader.getConfig().settings;
        const grayscale = settings?.unplacedPieceGrayscale ?? 0;

        if (!piece.placed && grayscale > 0) {
            ctx.filter = `grayscale(${grayscale * 100}%) brightness(${100 - (grayscale * 50)}%)`;
        }

        if (image) {
            ctx.drawImage(image, piece.sx, piece.sy, piece.sw, piece.sh, piece.x, piece.y, piece.width, piece.height);
        } else {
            const hue = (piece.id * 47) % 360;
            ctx.fillStyle = `hsl(${hue}, 50%, 40%)`;
            ctx.fillRect(piece.x, piece.y, piece.width, piece.height);
        }

        ctx.filter = 'none';

        ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        let borderColor = 'rgba(180, 160, 200, 0.3)';
        if (piece.placed) borderColor = 'rgba(34, 197, 94, 0.7)';
        else if (piece.dragging) borderColor = '#f97316';
        else if (this.isPieceOnGrid(piece)) borderColor = 'rgba(251, 146, 60, 0.5)';

        ctx.strokeStyle = borderColor; ctx.lineWidth = piece.dragging ? 2.5 : 1.5;
        ctx.beginPath(); ctx.roundRect(piece.x, piece.y, piece.width, piece.height, 3); ctx.stroke();

        if (this.showId && !piece.placed) {
            ctx.translate(cx, cy - liftY);
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
            if (piece.dragging) {
                const skewX = Math.max(-0.15, Math.min(0.15, piece.dragVelX * 0.003));
                const skewY = Math.max(-0.1, Math.min(0.1, piece.dragVelY * 0.002));
                ctx.transform(1, skewY, skewX, 1, 0, 0);
            }
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.fillText(`${piece.id}`, 0, 0);
        }

        ctx.restore();
    }

    private isPieceOnGrid(_piece: PuzzlePiece): boolean {
        // Since all pieces are always on grid now, this just means "not locked"
        return true;
    }

    private renderCelebration(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        ctx.fillStyle = `rgba(254, 243, 226, ${this.celebrationAlpha * 0.92})`;
        ctx.fillRect(0, 0, w, h);
        const image = this.assetManager.getImage(this.level!.image);
        if (image) {
            const padding = 40;
            const maxW = w - padding * 2;
            const maxH = h - padding * 2;
            const imgAspect = image.width / image.height;
            const screenAspect = maxW / maxH;
            let drawW, drawH;
            if (imgAspect > screenAspect) { drawW = maxW; drawH = maxW / imgAspect; }
            else { drawH = maxH; drawW = maxH * imgAspect; }
            ctx.globalAlpha = this.celebrationAlpha;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 10;

            // If the user used fitForce, the puzzle might be visually incorrect because
            // logical target pieces were swapped. Thus we draw the placed pieces instead
            // of the full original image.
            if (this.usedFitForce) {
                const startX = (w - drawW) / 2;
                const startY = (h - drawH) / 2;
                const pieceW = drawW / this.level!.cols;
                const pieceH = drawH / this.level!.rows;

                for (const piece of this.pieces) {
                    const c = piece.col;
                    const r = piece.row;
                    const px = startX + c * pieceW;
                    const py = startY + r * pieceH;
                    ctx.drawImage(image, piece.sx, piece.sy, piece.sw, piece.sh, px, py, pieceW + 0.5, pieceH + 0.5);
                }
            } else {
                ctx.drawImage(image, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
            }

            ctx.restore();
        }

        for (const p of this.starParticles) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.font = `${p.size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('⭐', 0, 0);
            ctx.restore();
        }

        if (this.celebrationTimer > 1.5) {
            ctx.globalAlpha = Math.min(1, (this.celebrationTimer - 1.5) * 2);
            ctx.fillStyle = '#7c3aed'; ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('WELL DONE!', w / 2, h / 2 - 120);
            const startX = w / 2 - 60;
            for (let i = 0; i < 3; i++) {
                ctx.fillText(i < this.celebrationStars ? '⭐' : '☆', startX + i * 60, h / 2 + 100);
            }

            // Draw a semi-transparent skip hint that pulses
            const pulse = 0.5 + 0.5 * Math.abs(Math.sin(this.elapsed * 3));
            ctx.globalAlpha = pulse;
            ctx.fillStyle = '#a5b4fc';
            ctx.font = '16px "Segoe UI", Arial, sans-serif';
            ctx.fillText('Tap to skip', w / 2, h - 40);
            ctx.globalAlpha = 1;
        }
    }

    private spawnStarParticle(): void {
        const x = Math.random() * this.canvasW;
        const y = -20;
        const life = 2 + Math.random() * 2;
        this.starParticles.push({
            x, y,
            vx: (Math.random() - 0.5) * 100,
            vy: 50 + Math.random() * 150,
            size: 15 + Math.random() * 20,
            rotation: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 5,
            alpha: 1,
            color: ['#fbbf24', '#f59e0b', '#fcd34d', '#7c3aed', '#ec4899'][Math.floor(Math.random() * 5)],
            life, maxLife: life
        });
    }

    private useHint(): void {
        if (this.gameEnded || this.hintPiece) return;
        const unplaced = this.pieces.filter(p => !p.placed);
        if (unplaced.length === 0) return;
        this.hintPiece = unplaced[Math.floor(Math.random() * unplaced.length)];
        this.hintTimer = 3;
        this.saveManager.usePowerUp('hint');
        this.assetManager.playSound('click');
        this.buildUI();
    }

    private useSlowTime(): void {
        if (this.gameEnded || this.isSlowTime) return;
        this.isSlowTime = true;
        this.slowTimeRemaining = 10;
        this.saveManager.usePowerUp('slowTime');
        this.assetManager.playSound('click');
        this.buildUI();
    }

    private useSkip(): void {
        if (this.gameEnded) return;
        this.assetManager.playSound('click');
        this.saveManager.usePowerUp('skip');
        this.triggerWin();
    }

    private goToShop(): void {
        if (this.gameEnded) return;
        const shopScene = this.stateManager.getScene(GameState.Shop) as any;
        if (shopScene) {
            shopScene.previousState = GameState.Gameplay;
        }
        this.pausedForShop = true;
        this.assetManager.playSound('click');
        this.stateManager.changeState(GameState.Shop);
    }

    private useFitForce(): void {
        if (this.gameEnded || this.fitForceMode) return;
        this.fitForceMode = true;
        this.fitForceLabel = new Label({
            x: 0, y: this.canvasH - 80, width: this.canvasW, height: 40,
            text: '🎯 Toca una pieza para forzarla a esa posicion',
            fontSize: 20, color: '#ec4899', bold: true
        });
        this.ui.addElement(this.fitForceLabel);
        this.assetManager.playSound('click');
    }

    private exitFitForceMode(): void {
        this.fitForceMode = false;
        this.fitForceLabel = null;
        this.buildUI();
    }

    private applyFitForce(tappedPiece: PuzzlePiece): void {
        this.usedFitForce = true;
        const currentCellCol = Math.round((tappedPiece.x - this.gridX) / this.cellSize);
        const currentCellRow = Math.round((tappedPiece.y - this.gridY) / this.cellSize);

        const displacedPiece = this.pieces.find(p => p.col === currentCellCol && p.row === currentCellRow);

        if (displacedPiece && displacedPiece !== tappedPiece) {
            // Swap their logical correct coordinates
            const tempCol = tappedPiece.col;
            const tempRow = tappedPiece.row;
            const tempTargetX = tappedPiece.targetX;
            const tempTargetY = tappedPiece.targetY;

            tappedPiece.col = displacedPiece.col;
            tappedPiece.row = displacedPiece.row;
            tappedPiece.targetX = displacedPiece.targetX;
            tappedPiece.targetY = displacedPiece.targetY;

            displacedPiece.col = tempCol;
            displacedPiece.row = tempRow;
            displacedPiece.targetX = tempTargetX;
            displacedPiece.targetY = tempTargetY;
        }

        this.placePieceLocked(tappedPiece);
        this.saveManager.usePowerUp('fitForce');
        this.exitFitForceMode();
    }

    private endCelebration(): void {
        this.celebrating = false;
        const unp = this.saveManager.getNextUncompletedLevel();
        if (unp && unp <= 4) {
            this.showNewPowerUpPopup(unp);
        } else {
            this.showWinOverlay();
        }
    }

    private showNewPowerUpPopup(levelId: number): void {
        const data: any = {
            1: { id: 'skip', name: 'Skip Level', emoji: '⏭️' },
            2: { id: 'hint', name: 'Hint', emoji: '💡' },
            3: { id: 'fitForce', name: 'Fit Force', emoji: '🎯' },
            4: { id: 'slowTime', name: 'Slow Time', emoji: '⏳' },
        }[levelId];
        if (!data) { this.showWinOverlay(); return; }

        this.saveManager.addPowerUp(data.id, 1);
        const w = this.canvasW; const h = this.canvasH;
        const panel = new Panel({ x: 0, y: 0, width: w, height: h, bgColor: 'rgba(0,0,0,0.85)' });
        this.ui.addElement(panel);
        const modal = new Panel({ x: w * 0.1, y: h * 0.25, width: w * 0.8, height: h * 0.5, bgColor: '#2d1b4d', borderRadius: 20, borderWidth: 3, borderColor: '#7c3aed' });
        this.ui.addElement(modal);
        this.ui.addElement(new Label({ x: 0, y: h * 0.3, width: w, height: 40, text: 'NEW POWER-UP!', fontSize: 24, color: '#fbbf24', bold: true }));
        this.ui.addElement(new Label({ x: 0, y: h * 0.4, width: w, height: 60, text: data.emoji, fontSize: 50 }));
        this.ui.addElement(new Label({ x: 0, y: h * 0.52, width: w, height: 30, text: data.name, fontSize: 20, color: '#fff', bold: true }));
        this.ui.addElement(new Label({ x: 0, y: h * 0.58, width: w, height: 20, text: '+1 Use Unlocked', fontSize: 14, color: '#a78bfa' }));
        this.ui.addElement(new Button({ x: w / 2 - 60, y: h * 0.65, width: 120, height: 45, text: 'Continue', bgColor: '#7c3aed', borderRadius: 12, onClick: () => { this.ui.clear(); this.showWinOverlay(); } }));
    }

    private showWinOverlay(): void {
        const w = this.canvasW; const h = this.canvasH;
        const overlay = new Panel({ x: 0, y: 0, width: w, height: h, bgColor: 'rgba(0,0,0,0.7)' });
        this.ui.addElement(overlay);
        const modalW = Math.min(w * 0.85, 320); const modalH = 340;
        const modal = new Panel({ x: (w - modalW) / 2, y: (h - modalH) / 2, width: modalW, height: modalH, bgColor: '#2d1b4d', borderRadius: 24, borderWidth: 4, borderColor: '#7c3aed' });
        this.ui.addElement(modal);
        this.ui.addElement(new Label({ x: 0, y: (h - modalH) / 2 + 30, width: w, height: 40, text: 'Level Complete!', fontSize: 28, color: '#fbbf24', bold: true }));
        const startX = w / 2 - 60;
        for (let i = 0; i < 3; i++) {
            this.ui.addElement(new Label({ x: startX + i * 60 - 15, y: (h - modalH) / 2 + 80, width: 30, height: 40, text: i < this.celebrationStars ? '⭐' : '☆', fontSize: 40, color: '#fbbf24' }));
        }

        let yOffset = 140;
        if (this.usedFitForce) {
            this.ui.addElement(new Label({ x: 0, y: (h - modalH) / 2 + yOffset, width: w, height: 20, text: 'Fit Force limitó las estrellas a 1!', fontSize: 14, color: '#ec4899', bold: true }));
            yOffset += 25;
        }

        this.ui.addElement(new Label({ x: 0, y: (h - modalH) / 2 + yOffset, width: w, height: 30, text: `Earned: ${this.celebrationStars * 10} 🪙`, fontSize: 20, color: '#fff' }));
        this.ui.addElement(new Button({ x: (w - 180) / 2, y: (h - modalH) / 2 + 200, width: 180, height: 50, text: 'Next Level', bgColor: '#059669', borderRadius: 15, onClick: () => { const nextId = this.level!.id + 1; const nextLevel = this.level!.id < 20 ? this.configLoader.getConfig().levels.find(l => l.id === nextId) : null; if (nextLevel) { this.level = nextLevel; this.enter(this.ctx); } else { this.stateManager.changeState(GameState.MainMenu); } } }));
        this.ui.addElement(new Button({ x: (w - 180) / 2, y: (h - modalH) / 2 + 265, width: 180, height: 45, text: 'Main Menu', bgColor: '#4b5563', borderRadius: 12, onClick: () => this.stateManager.changeState(GameState.MainMenu) }));
    }

    onPointer(event: GamePointerEvent): void {
        if (!this.level) return;

        // UI gets first dibs (needed for popups/buttons during celebration/game over)
        if (this.ui.handlePointer(event)) return;

        if (this.celebrating && event.type === 'down') {
            this.endCelebration();
            return;
        }

        if (this.celebrating || this.gameEnded) return;

        if (this.fitForceMode) {
            if (event.type === 'down') {
                for (let i = this.pieces.length - 1; i >= 0; i--) {
                    const p = this.pieces[i];
                    if (p.placed) continue;
                    if (event.x >= p.x && event.x <= p.x + p.width && event.y >= p.y && event.y <= p.y + p.height) {
                        this.applyFitForce(p);
                        return;
                    }
                }
            }
            return;
        }

        if (event.type === 'down') {
            for (let i = this.pieces.length - 1; i >= 0; i--) {
                const p = this.pieces[i]; if (p.placed) continue;
                if (event.x >= p.x && event.x <= p.x + p.width && event.y >= p.y && event.y <= p.y + p.height) {
                    this.dragPiece = p; p.dragging = true; p.prevX = p.x; p.prevY = p.y;
                    this.dragOffX = event.x - p.x; this.dragOffY = event.y - p.y;
                    this.dragFromGridCol = Math.round((p.prevX - this.gridX) / this.cellSize);
                    this.dragFromGridRow = Math.round((p.prevY - this.gridY) / this.cellSize);
                    p.width = this.cellSize; p.height = this.cellSize; p.animScale = 1.12; p.animScaleTarget = 1.05;
                    p.animOffsetY = 8; p.animRotation = (Math.random() - 0.5) * 0.05;
                    break;
                }
            }
        } else if (event.type === 'move' && this.dragPiece) {
            const p = this.dragPiece; const newX = event.x - this.dragOffX; const newY = event.y - this.dragOffY;
            p.dragVelX = newX - p.x; p.dragVelY = newY - p.y; p.x = newX; p.y = newY;
            p.animRotation = Math.max(-0.12, Math.min(0.12, p.dragVelX * 0.008));
        } else if (event.type === 'up' && this.dragPiece) {
            const p = this.dragPiece;
            p.dragging = false;
            p.animScaleTarget = 1;
            p.animOffsetY = 0;
            p.dragVelX = 0;
            p.dragVelY = 0;

            const cell = this.findGridCellAt(event.x, event.y);
            if (cell) {
                const locked = this.findLockedPieceOnCell(cell.col, cell.row);
                if (locked) {
                    // Cannot place on locked cell, return to start
                    this.placePieceAt(p, this.dragFromGridCol, this.dragFromGridRow);
                } else {
                    const unlocked = this.findUnlockedPieceOnCell(cell.col, cell.row, p);
                    if (unlocked) {
                        // Swap: displaced goes to where dragged piece came from
                        this.placePieceAt(unlocked, this.dragFromGridCol, this.dragFromGridRow);
                    }
                    // Place the dragged piece in new cell
                    this.placePieceAt(p, cell.col, cell.row);
                }
            } else {
                // Dropped outside grid — return to old position
                this.placePieceAt(p, this.dragFromGridCol, this.dragFromGridRow);
            }

            this.dragFromGridCol = -1;
            this.dragFromGridRow = -1;
            this.dragPiece = null;
        }
    }

    private getPieceById(id: number): PuzzlePiece { return this.pieces[id]; }
}
