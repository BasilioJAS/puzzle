/**
 * Corte de fichas en el navegador (usado por el editor de niveles).
 * Produce PNGs con transparencia, idénticos a los que genera tools/gen_level.py.
 */
import { cutPolygons, type CutSpec, type CutResult, type Pt } from './ears';

export interface CutPiecePng {
    col: number;
    row: number;
    ox: number;
    oy: number;
    w: number;
    h: number;
    /** data URL image/png */
    url: string;
    /** bytes del PNG (para exportar el zip) */
    bytes: Uint8Array;
}

export interface BrowserCutResult extends CutResult {
    pngs: CutPiecePng[];
}

/** Recorta la imagen para que sea múltiplo exacto de cols/rows. */
export function normalizeSource(img: HTMLImageElement | HTMLCanvasElement, cols: number, rows: number): HTMLCanvasElement {
    const sw = (img as HTMLImageElement).naturalWidth || img.width;
    const sh = (img as HTMLImageElement).naturalHeight || img.height;
    const w = Math.floor(sw / cols) * cols;
    const h = Math.floor(sh / rows) * rows;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d')!;
    g.drawImage(img, Math.floor((sw - w) / 2), Math.floor((sh - h) / 2), w, h, 0, 0, w, h);
    return cv;
}

function tracePoly(g: CanvasRenderingContext2D, poly: Pt[], ox: number, oy: number) {
    g.beginPath();
    g.moveTo(poly[0].x - ox, poly[0].y - oy);
    for (let i = 1; i < poly.length; i++) g.lineTo(poly[i].x - ox, poly[i].y - oy);
    g.closePath();
}

function dataUrlToBytes(url: string): Uint8Array {
    const b64 = url.slice(url.indexOf(',') + 1);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

export function cutImageToPieces(
    source: HTMLCanvasElement,
    spec: Omit<CutSpec, 'imgW' | 'imgH'>,
    opts: { stroke?: string; strokeWidth?: number } = {}
): BrowserCutResult {
    const res = cutPolygons({ ...spec, imgW: source.width, imgH: source.height });
    const pngs: CutPiecePng[] = [];
    const w = Math.round(res.pieceW), h = Math.round(res.pieceH);

    for (const p of res.pieces) {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d')!;
        g.save();
        tracePoly(g, p.poly, p.ox, p.oy);
        g.clip();
        g.drawImage(source, -p.ox, -p.oy);
        g.restore();
        if (opts.stroke) {
            g.save();
            tracePoly(g, p.poly, p.ox, p.oy);
            g.strokeStyle = opts.stroke;
            g.lineWidth = opts.strokeWidth ?? 1.5;
            g.stroke();
            g.restore();
        }
        const url = cv.toDataURL('image/png');
        pngs.push({ col: p.col, row: p.row, ox: p.ox, oy: p.oy, w, h, url, bytes: dataUrlToBytes(url) });
    }

    return { ...res, pngs };
}
