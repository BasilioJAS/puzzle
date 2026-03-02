import { GamePointerEvent, PointerEventType } from '../types/GameTypes';

export type PointerCallback = (event: GamePointerEvent) => void;

export class InputManager {
    private canvas: HTMLCanvasElement;
    private callbacks: PointerCallback[] = [];
    private scaleX: number = 1;
    private scaleY: number = 1;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.bindEvents();
    }

    updateScale(logicalW: number, logicalH: number): void {
        const rect = this.canvas.getBoundingClientRect();
        this.scaleX = logicalW / rect.width;
        this.scaleY = logicalH / rect.height;
    }

    onPointer(cb: PointerCallback): void {
        this.callbacks.push(cb);
    }

    clearCallbacks(): void {
        this.callbacks = [];
    }

    private emit(x: number, y: number, type: PointerEventType | 'wheel', nativeEvent?: MouseEvent | TouchEvent | WheelEvent): void {
        const event: GamePointerEvent = { x, y, type: type as PointerEventType, nativeEvent: nativeEvent as any };
        for (const cb of this.callbacks) {
            cb(event);
        }
    }

    private getPos(e: MouseEvent | Touch): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * this.scaleX,
            y: (e.clientY - rect.top) * this.scaleY,
        };
    }

    private bindEvents(): void {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
            const p = this.getPos(e);
            this.emit(p.x, p.y, 'down', e);
        });

        this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
            const p = this.getPos(e);
            this.emit(p.x, p.y, 'move', e);
        });

        this.canvas.addEventListener('mouseup', (e: MouseEvent) => {
            const p = this.getPos(e);
            this.emit(p.x, p.y, 'up', e);
        });

        // Wheel (Zoom in Desktop)
        this.canvas.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            const p = this.getPos(e);
            this.emit(p.x, p.y, 'wheel', e);
        }, { passive: false });

        // Touch events
        this.canvas.addEventListener('touchstart', (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const t = e.touches[0];
                const p = this.getPos(t);
                this.emit(p.x, p.y, 'down', e);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                const t = e.touches[0];
                const p = this.getPos(t);
                this.emit(p.x, p.y, 'move', e);
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e: TouchEvent) => {
            e.preventDefault();
            if (e.changedTouches.length > 0) {
                const t = e.changedTouches[0];
                const p = this.getPos(t);
                this.emit(p.x, p.y, 'up', e);
            }
        }, { passive: false });
    }
}
