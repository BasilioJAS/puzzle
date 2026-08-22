/**
 * Editor de orejas: edita la curva bezier del "diente" del rompecabezas.
 *
 * La curva vive sobre una arista unitaria de (0,0) a (1,0); Y es cuánto sobresale.
 * Se guardan en el dispositivo y se pueden exportar a public/config/ears.json,
 * que es el mismo archivo que lee la tool de Python.
 */
import '../style.css';
import { applyTheme, type GameConfig } from '../config';
import { el } from '../core/dom';
import { flattenEar, cutPolygons, hashSeed, type EarLibrary, type EarShape } from '../puzzle/ears';
import { deleteCustomEar, mergedEars, readCustomEars, saveCustomEar } from './store';
import { download } from '../editor/zip';

const PREVIEW_IMG = 'samples/34.jpg';

interface Handle { seg: number; idx: 0 | 1 | 2; }   // 0=c1, 1=c2, 2=fin del segmento

let base: EarLibrary;
let lib: EarLibrary;
let currentId = '';
let shape: EarShape;

async function main(): Promise<void> {
    const cfgRes = await fetch('config/game.config.json');
    applyTheme(await cfgRes.json() as GameConfig);
    base = await (await fetch('config/ears.json')).json();
    lib = mergedEars(base);
    currentId = base.default;
    shape = clone(lib.shapes[currentId]);
    render();
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function render(): void {
    const host = document.getElementById('app')!;
    host.replaceChildren();

    const curve = el('canvas', { width: 720, height: 420 }) as HTMLCanvasElement;
    const preview = el('canvas', { width: 460, height: 460 }) as HTMLCanvasElement;
    const out = el('div', { class: 'out' });

    const shapeSel = el('select') as HTMLSelectElement;
    const idInput = el('input', { type: 'text', value: currentId }) as HTMLInputElement;
    const nameInput = el('input', { type: 'text', value: shape.name }) as HTMLInputElement;

    const fillSelect = () => {
        lib = mergedEars(base);
        const custom = readCustomEars();
        shapeSel.replaceChildren(...Object.keys(lib.shapes).map(id =>
            el('option', { value: id, ...(id === currentId ? { selected: 'selected' } : {}) },
                `${lib.shapes[id].name} (${id})${custom[id] ? ' •' : ''}`)));
    };
    fillSelect();

    shapeSel.addEventListener('change', () => {
        currentId = shapeSel.value;
        shape = clone(lib.shapes[currentId]);
        idInput.value = currentId;
        nameInput.value = shape.name;
        redraw();
    });

    const segInfo = el('span', { class: 'dim tiny' });

    const view = el('div', { class: 'screen tool' },
        el('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'flex-start' } },
            el('div', {},
                el('h1', {}, 'Editor de orejas'),
                el('div', { class: 'hint' },
                    'Arrastrá los puntos: naranja = tiradores del bezier, celeste = uniones entre tramos. ' +
                    'La arista va de 0 a 1; la altura del diente es la Y.'),
            ),
            el('a', { href: './index.html', class: 'btn small ghost' }, '← juego'),
        ),

        el('div', { class: 'grid2', style: { marginTop: '14px' } },
            el('div', {},
                el('h2', {}, 'Oreja'),
                el('div', { class: 'field' }, el('label', {}, 'Editar una existente'), shapeSel),
                el('div', { class: 'field' }, el('label', {}, 'id (el que va en el level.json)'), idInput),
                el('div', { class: 'field' }, el('label', {}, 'nombre visible'), nameInput),

                el('h2', {}, 'Tramos'),
                el('div', { class: 'bar' },
                    el('button', { class: 'btn small', onclick: addSeg }, '+ tramo'),
                    el('button', { class: 'btn small ghost', onclick: delSeg }, '− tramo'),
                    el('button', { class: 'btn small ghost', onclick: mirror }, 'simetrizar'),
                    el('button', { class: 'btn small ghost', onclick: reset }, 'volver a la base'),
                ),
                segInfo,

                el('h2', {}, 'Guardar'),
                el('div', { class: 'bar' },
                    el('button', { class: 'btn small primary', onclick: doSave }, 'Guardar en el dispositivo'),
                    el('button', { class: 'btn small', onclick: doExport }, 'Descargar ears.json'),
                    el('button', { class: 'btn small ghost', onclick: doDelete }, 'Borrar esta oreja'),
                ),
                el('div', { class: 'hint' },
                    'Guardar la deja disponible en el editor de niveles de este teléfono. ' +
                    'Descargar ears.json te da el archivo para reemplazar en proto/public/config/ ' +
                    'y usarlo también desde la tool de Python (--ears).'),
                out,
            ),

            el('div', {},
                el('h2', {}, 'Curva'),
                curve,
                el('h2', {}, 'Cómo queda'),
                preview,
            ),
        ),
    );
    host.append(view);

    /* ---------- curva editable ---------- */

    const PAD = 60;
    const g = curve.getContext('2d')!;
    let W = 0, H = 0, originY = 0, scale = 0;

    const fitCurve = () => {
        const rect = curve.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        curve.width = Math.round(rect.width * dpr);
        curve.height = Math.round(rect.height * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        W = rect.width; H = rect.height;
        scale = W - PAD * 2;
        originY = H * 0.72;
    };

    const toPx = (x: number, y: number) => ({ px: PAD + x * scale, py: originY - y * scale });
    const toUnit = (px: number, py: number) => ({ x: (px - PAD) / scale, y: (originY - py) / scale });

    function handles(): { h: Handle; x: number; y: number; movable: boolean }[] {
        const list: { h: Handle; x: number; y: number; movable: boolean }[] = [];
        shape.segments.forEach((s, i) => {
            list.push({ h: { seg: i, idx: 0 }, x: s[0], y: s[1], movable: true });
            list.push({ h: { seg: i, idx: 1 }, x: s[2], y: s[3], movable: true });
            const last = i === shape.segments.length - 1;
            list.push({ h: { seg: i, idx: 2 }, x: s[4], y: s[5], movable: !last });
        });
        return list;
    }

    let drag: Handle | null = null;

    curve.addEventListener('pointerdown', e => {
        const r = curve.getBoundingClientRect();
        const px = e.clientX - r.left, py = e.clientY - r.top;
        let best: Handle | null = null, bestD = 18;
        for (const h of handles()) {
            if (!h.movable) continue;
            const p = toPx(h.x, h.y);
            const d = Math.hypot(p.px - px, p.py - py);
            if (d < bestD) { bestD = d; best = h.h; }
        }
        if (best) { drag = best; curve.setPointerCapture(e.pointerId); }
    });

    curve.addEventListener('pointermove', e => {
        if (!drag) return;
        const r = curve.getBoundingClientRect();
        const u = toUnit(e.clientX - r.left, e.clientY - r.top);
        const s = shape.segments[drag.seg];
        const i = drag.idx * 2;
        s[i] = Math.round(Math.max(-0.4, Math.min(1.4, u.x)) * 1000) / 1000;
        s[i + 1] = Math.round(Math.max(-0.8, Math.min(0.8, u.y)) * 1000) / 1000;
        redraw();
    });
    const stop = () => { drag = null; redrawPreview(); };
    curve.addEventListener('pointerup', stop);
    curve.addEventListener('pointercancel', stop);

    function drawCurve(): void {
        fitCurve();
        const cs = getComputedStyle(document.documentElement);
        const col = (n: string) => cs.getPropertyValue(n).trim();
        g.clearRect(0, 0, W, H);

        // grilla + arista base
        g.strokeStyle = 'rgba(255,255,255,.08)';
        g.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = PAD + (i / 10) * scale;
            g.beginPath(); g.moveTo(x, 20); g.lineTo(x, H - 20); g.stroke();
        }
        g.strokeStyle = 'rgba(255,255,255,.25)';
        g.setLineDash([6, 6]);
        g.beginPath(); g.moveTo(PAD, originY); g.lineTo(PAD + scale, originY); g.stroke();
        g.setLineDash([]);

        // curva
        const pts = flattenEar(shape, 24);
        g.strokeStyle = col('--accent2') || '#3ad6ff';
        g.lineWidth = 3;
        g.beginPath();
        pts.forEach((p, i) => {
            const q = toPx(p.x, p.y);
            i ? g.lineTo(q.px, q.py) : g.moveTo(q.px, q.py);
        });
        g.stroke();

        // tiradores
        let prev = { x: 0, y: 0 };
        shape.segments.forEach(s => {
            const a = toPx(prev.x, prev.y);
            const c1 = toPx(s[0], s[1]);
            const c2 = toPx(s[2], s[3]);
            const b = toPx(s[4], s[5]);
            g.strokeStyle = 'rgba(255,176,58,.4)';
            g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(a.px, a.py); g.lineTo(c1.px, c1.py); g.stroke();
            g.beginPath(); g.moveTo(b.px, b.py); g.lineTo(c2.px, c2.py); g.stroke();
            prev = { x: s[4], y: s[5] };
        });

        for (const h of handles()) {
            const p = toPx(h.x, h.y);
            g.beginPath();
            g.arc(p.px, p.py, h.h.idx === 2 ? 8 : 6, 0, Math.PI * 2);
            g.fillStyle = h.h.idx === 2
                ? (h.movable ? (col('--accent2') || '#3ad6ff') : 'rgba(255,255,255,.35)')
                : (col('--accent') || '#ffb03a');
            g.fill();
        }

        segInfo.textContent = `${shape.segments.length} tramos · altura máxima ${maxY().toFixed(3)} de la arista`;
    }

    /* ---------- vista previa ---------- */

    let previewImg: HTMLImageElement | null = null;
    const pctx = preview.getContext('2d')!;

    function redrawPreview(): void {
        const size = 460;
        preview.width = size; preview.height = size;
        pctx.clearRect(0, 0, size, size);
        const cols = 2, rows = 2;
        const imgSide = 400;
        const res = cutPolygons({
            cols, rows, imgW: imgSide, imgH: imgSide, shape,
            tabRatio: base.tabRatio, flatten: base.flatten, seed: hashSeed('preview'),
        });
        const off = 30;   // separación para que se vean los dientes
        for (const p of res.pieces) {
            const dx = (p.col - 0.5) * off + off;
            const dy = (p.row - 0.5) * off + off;
            pctx.save();
            pctx.translate(dx, dy);
            pctx.beginPath();
            p.poly.forEach((q, i) => i ? pctx.lineTo(q.x, q.y) : pctx.moveTo(q.x, q.y));
            pctx.closePath();
            pctx.save();
            pctx.clip();
            if (previewImg) pctx.drawImage(previewImg, 0, 0, imgSide, imgSide);
            else { pctx.fillStyle = '#3ad6ff44'; pctx.fillRect(0, 0, imgSide, imgSide); }
            pctx.restore();
            pctx.strokeStyle = 'rgba(0,0,0,.5)';
            pctx.lineWidth = 1.5;
            pctx.stroke();
            pctx.restore();
        }
        out.textContent = JSON.stringify({ [idInput.value || currentId]: shapeOut() }, null, 2);
    }

    if (!previewImg) {
        const i = new Image();
        i.onload = () => { previewImg = i; redrawPreview(); };
        i.src = PREVIEW_IMG;
    }

    const redraw = () => { drawCurve(); redrawPreview(); };
    requestAnimationFrame(redraw);
    window.addEventListener('resize', redraw);

    /* ---------- acciones ---------- */

    function maxY(): number {
        let mx = 0;
        for (const s of shape.segments) mx = Math.max(mx, Math.abs(s[1]), Math.abs(s[3]), Math.abs(s[5]));
        return mx;
    }

    function shapeOut(): EarShape {
        return { name: nameInput.value || currentId, segments: shape.segments };
    }

    function addSeg(): void {
        const last = shape.segments[shape.segments.length - 1];
        const prevEnd = shape.segments.length > 1 ? shape.segments[shape.segments.length - 2] : null;
        const startX = prevEnd ? prevEnd[4] : 0;
        const mid = (startX + last[4]) / 2;
        shape.segments.splice(shape.segments.length - 1, 0,
            [startX + (mid - startX) * 0.4, 0, mid - 0.02, 0, mid, 0]);
        redraw();
    }

    function delSeg(): void {
        if (shape.segments.length <= 2) return;
        shape.segments.splice(shape.segments.length - 2, 1);
        redraw();
    }

    /** Espeja la mitad izquierda sobre la derecha para que el diente quede simétrico. */
    function mirror(): void {
        const n = shape.segments.length;
        const half = Math.floor(n / 2);
        for (let i = 0; i < half; i++) {
            const a = shape.segments[i];
            const b = shape.segments[n - 1 - i];
            b[0] = 1 - a[2]; b[1] = a[3];
            b[2] = 1 - a[0]; b[3] = a[1];
            if (n - 1 - i !== n - 1) { b[4] = 1 - (i === 0 ? 0 : shape.segments[i - 1][4]); b[5] = 0; }
        }
        // el punto medio queda centrado
        if (n % 2 === 1) {
            const mid = shape.segments[half];
            mid[4] = 0.5 + (mid[4] - 0.5) * 0;
        }
        redraw();
    }

    function reset(): void {
        shape = clone(base.shapes[base.default]);
        nameInput.value = shape.name;
        redraw();
    }

    function doSave(): void {
        const id = (idInput.value || '').trim();
        if (!id) { alert('Poné un id.'); return; }
        saveCustomEar(id, shapeOut());
        currentId = id;
        fillSelect();
        shapeSel.value = id;
        alert(`Oreja "${id}" guardada en este dispositivo.\nYa la podés elegir en el editor de niveles.`);
    }

    function doExport(): void {
        const merged = mergedEars(base);
        const id = (idInput.value || currentId).trim();
        merged.shapes[id] = shapeOut();
        const json = JSON.stringify(merged, null, 2);
        download(new Blob([json], { type: 'application/json' }), 'ears.json');
    }

    function doDelete(): void {
        const id = (idInput.value || currentId).trim();
        if (!readCustomEars()[id]) { alert('Esa oreja viene en ears.json, no se borra desde acá.'); return; }
        deleteCustomEar(id);
        currentId = base.default;
        shape = clone(base.shapes[currentId]);
        render();
    }
}

void main();
