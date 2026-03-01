import { GamePointerEvent } from '../types/GameTypes';

// ─── UI Element Base ───
export interface UIElementOptions {
    x: number;
    y: number;
    width: number;
    height: number;
    visible?: boolean;
}

export class UIElement {
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;

    constructor(opts: UIElementOptions) {
        this.x = opts.x;
        this.y = opts.y;
        this.width = opts.width;
        this.height = opts.height;
        this.visible = opts.visible ?? true;
    }

    containsPoint(px: number, py: number): boolean {
        return (
            px >= this.x &&
            px <= this.x + this.width &&
            py >= this.y &&
            py <= this.y + this.height
        );
    }

    draw(_ctx: CanvasRenderingContext2D): void {
        // Override in subclass
    }
}

// ─── Button ───
export interface ButtonOptions extends UIElementOptions {
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    textColor?: string;
    bgColor?: string;
    bgColorHover?: string;
    bgColorPressed?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    icon?: HTMLImageElement;
    iconSize?: number;
    onClick?: () => void;
}

export class Button extends UIElement {
    text: string;
    fontSize: number;
    fontFamily: string;
    textColor: string;
    bgColor: string;
    bgColorHover: string;
    bgColorPressed: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    icon?: HTMLImageElement;
    iconSize: number;
    onClick?: () => void;
    isHover: boolean = false;
    isPressed: boolean = false;

    // Animation state
    animScale: number = 1;
    animScaleTarget: number = 1;
    animColorT: number = 0; // 0=normal, 1=hover/pressed

    constructor(opts: ButtonOptions) {
        super(opts);
        this.text = opts.text ?? '';
        this.fontSize = opts.fontSize ?? 18;
        this.fontFamily = opts.fontFamily ?? "'Segoe UI', Arial, sans-serif";
        this.textColor = opts.textColor ?? '#ffffff';
        this.bgColor = opts.bgColor ?? '#4a90d9';
        this.bgColorHover = opts.bgColorHover ?? '#5ba0e9';
        this.bgColorPressed = opts.bgColorPressed ?? '#3a70b9';
        this.borderColor = opts.borderColor ?? 'rgba(255,255,255,0.2)';
        this.borderWidth = opts.borderWidth ?? 2;
        this.borderRadius = opts.borderRadius ?? 12;
        this.icon = opts.icon;
        this.iconSize = opts.iconSize ?? 24;
        this.onClick = opts.onClick;
    }

    update(dt: number): void {
        // Target scale based on state
        if (this.isPressed) {
            this.animScaleTarget = 0.93;
        } else if (this.isHover) {
            this.animScaleTarget = 1.05;
        } else {
            this.animScaleTarget = 1.0;
        }

        // Lerp scale with elastic feel
        const speed = this.isPressed ? 18 : 12;
        this.animScale += (this.animScaleTarget - this.animScale) * Math.min(1, dt * speed);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;

        const bg = this.isPressed
            ? this.bgColorPressed
            : this.isHover
                ? this.bgColorHover
                : this.bgColor;

        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;

        ctx.save();

        // Apply scale transform from center
        ctx.translate(cx, cy);
        ctx.scale(this.animScale, this.animScale);
        ctx.translate(-cx, -cy);

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 3 * this.animScale;

        // Background rounded rect
        this.roundRect(ctx, this.x, this.y, this.width, this.height, this.borderRadius);
        ctx.fillStyle = bg;
        ctx.fill();

        // Reset shadow for remaining draws
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Border
        if (this.borderWidth > 0) {
            this.roundRect(ctx, this.x, this.y, this.width, this.height, this.borderRadius);
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = this.borderWidth;
            ctx.stroke();
        }

        // Inner highlight (top)
        ctx.beginPath();
        this.roundRect(ctx, this.x + 2, this.y + 2, this.width - 4, this.height / 2 - 2, Math.max(0, this.borderRadius - 2));
        ctx.fillStyle = this.isPressed ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)';
        ctx.fill();

        // Icon + Text
        let textX = cx;
        if (this.icon) {
            const iconX = this.x + 12;
            const iconY = this.y + (this.height - this.iconSize) / 2;
            ctx.drawImage(this.icon, iconX, iconY, this.iconSize, this.iconSize);
            textX = this.x + 12 + this.iconSize + (this.width - 12 - this.iconSize) / 2;
        }

        if (this.text) {
            ctx.fillStyle = this.textColor;
            ctx.font = `bold ${this.fontSize}px ${this.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.text, textX, cy + 1);
        }

        ctx.restore();
    }

    private roundRect(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number, r: number
    ): void {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

// ─── Label ───
export interface LabelOptions extends UIElementOptions {
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    bold?: boolean;
}

export class Label extends UIElement {
    text: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    align: CanvasTextAlign;
    baseline: CanvasTextBaseline;
    bold: boolean;

    constructor(opts: LabelOptions) {
        super(opts);
        this.text = opts.text ?? '';
        this.fontSize = opts.fontSize ?? 16;
        this.fontFamily = opts.fontFamily ?? "'Segoe UI', Arial, sans-serif";
        this.color = opts.color ?? '#ffffff';
        this.align = opts.align ?? 'center';
        this.baseline = opts.baseline ?? 'middle';
        this.bold = opts.bold ?? false;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.visible || !this.text) return;
        ctx.fillStyle = this.color;
        ctx.font = `${this.bold ? 'bold ' : ''}${this.fontSize}px ${this.fontFamily}`;
        ctx.textAlign = this.align;
        ctx.textBaseline = this.baseline;

        let tx = this.x;
        if (this.align === 'center') tx = this.x + this.width / 2;
        else if (this.align === 'right') tx = this.x + this.width;

        ctx.fillText(this.text, tx, this.y + this.height / 2);
    }
}

// ─── Panel ───
export interface PanelOptions extends UIElementOptions {
    bgColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    alpha?: number;
}

export class Panel extends UIElement {
    bgColor: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    alpha: number;

    constructor(opts: PanelOptions) {
        super(opts);
        this.bgColor = opts.bgColor ?? 'rgba(0,0,0,0.6)';
        this.borderColor = opts.borderColor ?? 'rgba(255,255,255,0.15)';
        this.borderWidth = opts.borderWidth ?? 1;
        this.borderRadius = opts.borderRadius ?? 16;
        this.alpha = opts.alpha ?? 1;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;

        ctx.beginPath();
        this.roundRect(ctx, this.x, this.y, this.width, this.height, this.borderRadius);
        ctx.fillStyle = this.bgColor;
        ctx.fill();

        if (this.borderWidth > 0) {
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = this.borderWidth;
            ctx.stroke();
        }

        ctx.restore();
    }

    private roundRect(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number, r: number
    ): void {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

// ─── Progress Bar ───
export interface ProgressBarOptions extends UIElementOptions {
    progress?: number;
    bgColor?: string;
    fillColor?: string;
    fillColorEnd?: string;
    borderColor?: string;
    borderRadius?: number;
    borderWidth?: number;
}

export class ProgressBar extends UIElement {
    progress: number;
    bgColor: string;
    fillColor: string;
    fillColorEnd: string;
    borderColor: string;
    borderRadius: number;
    borderWidth: number;

    constructor(opts: ProgressBarOptions) {
        super(opts);
        this.progress = opts.progress ?? 0;
        this.bgColor = opts.bgColor ?? 'rgba(255,255,255,0.1)';
        this.fillColor = opts.fillColor ?? '#4ade80';
        this.fillColorEnd = opts.fillColorEnd ?? '#22d3ee';
        this.borderColor = opts.borderColor ?? 'rgba(255,255,255,0.2)';
        this.borderRadius = opts.borderRadius ?? 8;
        this.borderWidth = opts.borderWidth ?? 1;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;

        // Background
        ctx.beginPath();
        this.roundRect(ctx, this.x, this.y, this.width, this.height, this.borderRadius);
        ctx.fillStyle = this.bgColor;
        ctx.fill();

        // Fill
        const fillW = Math.max(0, (this.width - 4) * Math.min(1, this.progress));
        if (fillW > 0) {
            const grad = ctx.createLinearGradient(this.x + 2, 0, this.x + 2 + fillW, 0);
            grad.addColorStop(0, this.fillColor);
            grad.addColorStop(1, this.fillColorEnd);
            ctx.beginPath();
            this.roundRect(ctx, this.x + 2, this.y + 2, fillW, this.height - 4, this.borderRadius - 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }

        // Border
        if (this.borderWidth > 0) {
            ctx.beginPath();
            this.roundRect(ctx, this.x, this.y, this.width, this.height, this.borderRadius);
            ctx.strokeStyle = this.borderColor;
            ctx.lineWidth = this.borderWidth;
            ctx.stroke();
        }
    }

    private roundRect(
        ctx: CanvasRenderingContext2D,
        x: number, y: number, w: number, h: number, r: number
    ): void {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
}

// ─── ScrollView ───
export interface ScrollViewOptions extends UIElementOptions {
    contentHeight: number;
    bgColor?: string;
}

export class ScrollView extends UIElement {
    contentHeight: number;
    scrollY: number = 0;
    bgColor: string;
    private isDragging: boolean = false;
    private lastY: number = 0;
    private startY: number = 0;
    private startX: number = 0;
    private totalDragDist: number = 0;
    private velocity: number = 0;
    children: UIElement[] = [];

    constructor(opts: ScrollViewOptions) {
        super(opts);
        this.contentHeight = opts.contentHeight;
        this.bgColor = opts.bgColor ?? 'transparent';
    }

    get maxScroll(): number {
        return Math.max(0, this.contentHeight - this.height);
    }

    addChild(el: UIElement): void {
        this.children.push(el);
    }

    clearChildren(): void {
        this.children = [];
    }

    handlePointer(event: GamePointerEvent): boolean {
        if (!this.visible) return false;
        if (!this.containsPoint(event.x, event.y) && event.type !== 'up' && !this.isDragging) return false;

        if (event.type === 'down') {
            this.isDragging = true;
            this.lastY = event.y;
            this.startY = event.y;
            this.startX = event.x;
            this.totalDragDist = 0;
            this.velocity = 0;
            return true;
        } else if (event.type === 'move' && this.isDragging) {
            const dy = this.lastY - event.y;
            this.totalDragDist += Math.abs(dy);
            this.velocity = dy;
            this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY + dy));
            this.lastY = event.y;
            return true;
        } else if (event.type === 'up') {
            const wasDragging = this.isDragging;
            this.isDragging = false;

            // If total drag distance is small, treat as a tap → forward to child buttons
            if (wasDragging && this.totalDragDist < 10) {
                // Convert screen coords to content coords (account for scroll offset)
                const contentX = event.x;
                const contentY = event.y + this.scrollY;

                // Check children in reverse order (top-most first)
                for (let i = this.children.length - 1; i >= 0; i--) {
                    const child = this.children[i];
                    if (child instanceof Button && child.visible && child.containsPoint(contentX, contentY)) {
                        child.onClick?.();
                        return true;
                    }
                }
            }

            return wasDragging;
        }
        return false;
    }

    update(dt: number): void {
        if (!this.isDragging && Math.abs(this.velocity) > 0.5) {
            this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY + this.velocity));
            this.velocity *= 0.92;
        } else if (!this.isDragging) {
            this.velocity = 0;
        }
        // Propagate update to child buttons for animations
        for (const child of this.children) {
            if (child instanceof Button) {
                child.update(dt);
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (!this.visible) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.clip();

        if (this.bgColor !== 'transparent') {
            ctx.fillStyle = this.bgColor;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

        ctx.translate(0, -this.scrollY);

        for (const child of this.children) {
            // Only render visible children
            const childBottom = child.y + child.height;
            const childTop = child.y;
            if (childBottom >= this.scrollY && childTop <= this.scrollY + this.height) {
                child.draw(ctx);
            }
        }

        ctx.restore();

        // Scrollbar indicator
        if (this.contentHeight > this.height) {
            const barH = Math.max(30, (this.height / this.contentHeight) * this.height);
            const barY = this.y + (this.scrollY / this.maxScroll) * (this.height - barH);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.roundRect(this.x + this.width - 6, barY, 4, barH, 2);
            ctx.fill();
        }
    }
}
