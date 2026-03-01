import { GamePointerEvent } from '../types/GameTypes';
import { UIElement, Button, ScrollView } from './UIElement';

export class UIManager {
    private elements: UIElement[] = [];
    private scrollViews: ScrollView[] = [];

    addElement(el: UIElement): void {
        this.elements.push(el);
        if (el instanceof ScrollView) {
            this.scrollViews.push(el);
        }
    }

    removeElement(el: UIElement): void {
        const idx = this.elements.indexOf(el);
        if (idx >= 0) this.elements.splice(idx, 1);
        if (el instanceof ScrollView) {
            const sIdx = this.scrollViews.indexOf(el);
            if (sIdx >= 0) this.scrollViews.splice(sIdx, 1);
        }
    }

    clear(): void {
        this.elements = [];
        this.scrollViews = [];
    }

    handlePointer(event: GamePointerEvent): boolean {
        // ScrollViews get priority
        for (const sv of this.scrollViews) {
            if (sv.handlePointer(event)) {
                // Check if it was a tap (down + up without much movement)
                // ScrollView consumes the event for scrolling
                return true;
            }
        }

        // Hit-test buttons (reverse order = top-most first)
        for (let i = this.elements.length - 1; i >= 0; i--) {
            const el = this.elements[i];
            if (!el.visible) continue;
            if (!(el instanceof Button)) continue;

            if (event.type === 'down' && el.containsPoint(event.x, event.y)) {
                el.isPressed = true;
                return true;
            } else if (event.type === 'move') {
                el.isHover = el.containsPoint(event.x, event.y);
                if (!el.isHover) el.isPressed = false;
            } else if (event.type === 'up') {
                if (el.isPressed && el.containsPoint(event.x, event.y)) {
                    el.isPressed = false;
                    el.onClick?.();
                    return true;
                }
                el.isPressed = false;
            }
        }

        return false;
    }

    update(dt: number): void {
        for (const sv of this.scrollViews) {
            sv.update(dt);
        }
        // Tick button animations
        for (const el of this.elements) {
            if (el instanceof Button) {
                el.update(dt);
            }
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        for (const el of this.elements) {
            if (el.visible) el.draw(ctx);
        }
    }
}
