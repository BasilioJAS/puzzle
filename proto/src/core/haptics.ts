/** Vibración. Los patrones salen del config; si el aparato no soporta, no hace nada. */
import { C } from '../config';
import { save } from './save';

export const canVibrate = (): boolean => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function vibrate(pattern: string): void {
    if (!save.data.settings.vibration || !canVibrate()) return;
    const p = C().haptics.patterns[pattern];
    if (p) navigator.vibrate(p);
}
