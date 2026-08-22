/** Orejas creadas con el editor, guardadas en el dispositivo. */
import type { EarLibrary, EarShape } from '../puzzle/ears';

export const EARS_KEY = 'puzzle-proto-ears-v1';

export function readCustomEars(): Record<string, EarShape> {
    try { return JSON.parse(localStorage.getItem(EARS_KEY) || '{}'); } catch { return {}; }
}

export function saveCustomEar(id: string, shape: EarShape): void {
    const all = readCustomEars();
    all[id] = shape;
    localStorage.setItem(EARS_KEY, JSON.stringify(all));
}

export function deleteCustomEar(id: string): void {
    const all = readCustomEars();
    delete all[id];
    localStorage.setItem(EARS_KEY, JSON.stringify(all));
}

/** Biblioteca base (ears.json) + las orejas propias del dispositivo. */
export function mergedEars(base: EarLibrary): EarLibrary {
    return { ...base, shapes: { ...base.shapes, ...readCustomEars() } };
}
