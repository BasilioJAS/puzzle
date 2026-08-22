/**
 * Geometría de las "orejas" (tabs) del rompecabezas.
 *
 * Una oreja se define como una curva normalizada sobre una arista unitaria que va
 * de (0,0) a (1,0). El eje Y es el desplazamiento hacia afuera de la pieza.
 * Se guarda como una lista de segmentos bezier cúbicos [c1x,c1y,c2x,c2y,x,y]
 * (el punto inicial de cada segmento es el final del anterior; el primero arranca en 0,0).
 *
 * Este mismo formato lo lee la tool de Python (tools/earlib.py), así que el corte
 * en el navegador y el corte en Python dan exactamente la misma forma.
 */

export interface EarShape {
    name: string;
    segments: number[][];
}

export interface EarLibrary {
    default: string;
    tabRatio: number;
    flatten: number;
    shapes: Record<string, EarShape>;
}

export interface Pt { x: number; y: number; }

/** Aplana la curva de la oreja a una polilínea normalizada de (0,0) a (1,0). */
export function flattenEar(shape: EarShape, steps: number): Pt[] {
    const out: Pt[] = [{ x: 0, y: 0 }];
    let px = 0, py = 0;
    for (const s of shape.segments) {
        const [c1x, c1y, c2x, c2y, ex, ey] = s;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps, u = 1 - t;
            const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
            out.push({
                x: a * px + b * c1x + c * c2x + d * ex,
                y: a * py + b * c1y + c * c2y + d * ey,
            });
        }
        px = ex; py = ey;
    }
    return out;
}

export function earMaxAbsY(shape: EarShape): number {
    let m = 0;
    for (const s of shape.segments) {
        m = Math.max(m, Math.abs(s[1]), Math.abs(s[3]), Math.abs(s[5]));
    }
    return m;
}

/** RNG determinístico (mulberry32) para que los signos de las orejas sean reproducibles. */
export function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashSeed(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

export interface CutSpec {
    cols: number;
    rows: number;
    imgW: number;      // debe ser múltiplo de cols
    imgH: number;      // debe ser múltiplo de rows
    shape: EarShape;
    tabRatio: number;
    flatten: number;
    seed: number;
}

export interface PieceCut {
    col: number;
    row: number;
    /** origen de la imagen de la pieza dentro de la imagen fuente */
    ox: number;
    oy: number;
    /** polígono en coordenadas de la imagen fuente */
    poly: Pt[];
}

export interface CutResult {
    cellW: number;
    cellH: number;
    margin: number;
    pieceW: number;
    pieceH: number;
    pieces: PieceCut[];
}

/**
 * Calcula el polígono de cada pieza. Las aristas interiores se generan una sola vez
 * en dirección canónica (izq→der / arriba→abajo) y la pieza vecina usa la misma
 * polilínea invertida: así los bordes encajan perfecto siempre.
 */
export function cutPolygons(spec: CutSpec): CutResult {
    const { cols, rows, imgW, imgH } = spec;
    const cellW = imgW / cols;
    const cellH = imgH / rows;
    // la oreja escala con el largo de cada arista, así que mantiene su proporción
    const maxY = earMaxAbsY(spec.shape) * spec.tabRatio;
    const margin = Math.ceil(maxY * Math.max(cellW, cellH)) + 2;
    const base = flattenEar(spec.shape, spec.flatten);
    const rand = rng(spec.seed);

    // signos de aristas interiores
    const hSign: number[][] = [];   // hSign[row][col] arista horizontal debajo de la fila row-1
    for (let r = 0; r < rows + 1; r++) {
        hSign.push([]);
        for (let c = 0; c < cols; c++) hSign[r].push(rand() < 0.5 ? -1 : 1);
    }
    const vSign: number[][] = [];   // vSign[row][col] arista vertical a la izquierda de la col
    for (let r = 0; r < rows; r++) {
        vSign.push([]);
        for (let c = 0; c < cols + 1; c++) vSign[r].push(rand() < 0.5 ? -1 : 1);
    }

    const edgePts = (ax: number, ay: number, bx: number, by: number, sign: number): Pt[] => {
        const dx = bx - ax, dy = by - ay;
        const len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;           // normal a la izquierda de la dirección
        const tab = spec.tabRatio * len;
        return base.map(p => ({
            x: ax + ux * p.x * len + nx * p.y * tab * sign,
            y: ay + uy * p.x * len + ny * p.y * tab * sign,
        }));
    };

    const straight = (ax: number, ay: number, bx: number, by: number): Pt[] =>
        [{ x: ax, y: ay }, { x: bx, y: by }];

    const pieces: PieceCut[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x0 = c * cellW, y0 = r * cellH, x1 = x0 + cellW, y1 = y0 + cellH;

            // arriba: izq→der (canónica)
            const top = r === 0 ? straight(x0, y0, x1, y0) : edgePts(x0, y0, x1, y0, hSign[r][c]);
            // derecha: arriba→abajo (canónica)
            const right = c === cols - 1 ? straight(x1, y0, x1, y1) : edgePts(x1, y0, x1, y1, vSign[r][c + 1]);
            // abajo: canónica es izq→der, la recorremos al revés
            const bottom = r === rows - 1
                ? straight(x1, y1, x0, y1)
                : edgePts(x0, y1, x1, y1, hSign[r + 1][c]).slice().reverse();
            // izquierda: canónica es arriba→abajo, la recorremos al revés
            const left = c === 0
                ? straight(x0, y1, x0, y0)
                : edgePts(x0, y0, x0, y1, vSign[r][c]).slice().reverse();

            const poly: Pt[] = [];
            const push = (arr: Pt[], skipFirst: boolean) => {
                for (let i = skipFirst ? 1 : 0; i < arr.length; i++) poly.push(arr[i]);
            };
            push(top, false); push(right, true); push(bottom, true); push(left, true);
            poly.pop(); // el último coincide con el primero

            pieces.push({ col: c, row: r, ox: x0 - margin, oy: y0 - margin, poly });
        }
    }

    return {
        cellW, cellH, margin,
        pieceW: cellW + margin * 2,
        pieceH: cellH + margin * 2,
        pieces,
    };
}
