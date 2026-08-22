/**
 * Análisis de una ficha al cargarla: máscara de alfa para el hit-test y color
 * dominante para el filtro. Las dos cosas salen de la misma pasada de píxeles.
 */

export interface ColorBucket {
    id: string;
    label: string;
    swatch: string;
    /** rango de tono en grados; puede envolver el 0 (ej. 345 → 15) */
    from?: number;
    to?: number;
    /** el balde de los grises/blancos/negros */
    neutral?: boolean;
}

export interface AnalyzeOptions {
    size: number;
    /** por debajo de esta saturación la ficha cuenta como neutra */
    neutralSaturation: number;
    /** cuánto pesa un píxel neutro frente a uno de color */
    neutralWeight: number;
}

export interface PieceAnalysis {
    mask: { w: number; h: number; data: Uint8Array };
    /** id del balde de color dominante, o null si la ficha está vacía */
    color: string | null;
}

/** tono en grados y saturación (0..1) de un RGB */
function hueSat(r: number, g: number, b: number): { h: number; s: number } {
    const R = r / 255, G = g / 255, B = b / 255;
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const d = max - min;
    if (d === 0) return { h: 0, s: 0 };
    let h: number;
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    // saturación de HSV: sirve mejor que la de HSL para "cuán de color es"
    return { h, s: max === 0 ? 0 : d / max };
}

function bucketFor(h: number, buckets: ColorBucket[]): ColorBucket | null {
    for (const b of buckets) {
        if (b.neutral || b.from === undefined || b.to === undefined) continue;
        const wraps = b.from > b.to;
        if (wraps ? (h >= b.from || h < b.to) : (h >= b.from && h < b.to)) return b;
    }
    return null;
}

export function analyzePiece(
    img: HTMLImageElement,
    buckets: ColorBucket[],
    opts: AnalyzeOptions,
): PieceAnalysis {
    const n = opts.size;
    const cv = document.createElement('canvas');
    cv.width = n; cv.height = n;
    const g = cv.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, n, n);
    const px = g.getImageData(0, 0, n, n).data;

    const mask = new Uint8Array(n * n);
    const score = new Map<string, number>();
    const neutral = buckets.find(b => b.neutral);

    for (let i = 0; i < mask.length; i++) {
        const a = px[i * 4 + 3];
        mask[i] = a;
        if (a < 128) continue;
        const { h, s } = hueSat(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
        if (s < opts.neutralSaturation) {
            if (neutral) score.set(neutral.id, (score.get(neutral.id) ?? 0) + opts.neutralWeight);
        } else {
            const b = bucketFor(h, buckets);
            // los píxeles saturados pesan proporcionalmente a su saturación:
            // así una ficha casi blanca con una mancha de color se filtra por esa mancha
            if (b) score.set(b.id, (score.get(b.id) ?? 0) + s);
        }
    }

    let best: string | null = null, bestScore = 0;
    for (const [id, v] of score) if (v > bestScore) { bestScore = v; best = id; }

    return { mask: { w: n, h: n, data: mask }, color: best };
}
