/**
 * Editor de niveles.
 *
 * Elegís imagen, cantidad de fichas, tiempo, oreja y tutorial; corta las fichas
 * en el navegador (mismos PNG con transparencia que genera la tool de Python) y
 * te deja: probarlo en el teléfono al toque, bajarte la carpeta del nivel en .zip,
 * o copiar el comando de la tool para generarlo en la compu.
 */
import '../style.css';
import {
    applyTheme, customLevelIds, deleteCustomLevel, saveCustomLevel,
    type GameConfig, type LevelConfig, type PieceDef,
} from '../config';
import { el } from '../core/dom';
import { cutPolygons, hashSeed, type EarLibrary } from '../puzzle/ears';
import { cutImageToPieces, normalizeSource, type BrowserCutResult } from '../puzzle/cutter';
import { mergedEars } from '../ears/store';
import { download, makeZip, type ZipEntry } from './zip';

const PRESETS = [
    { label: '4 fichas (2×2) — muy fácil', cols: 2, rows: 2 },
    { label: '9 fichas (3×3) — fácil', cols: 3, rows: 3 },
    { label: '16 fichas (4×4) — normal', cols: 4, rows: 4 },
    { label: '25 fichas (5×5) — difícil', cols: 5, rows: 5 },
    { label: '36 fichas (6×6) — muy difícil', cols: 6, rows: 6 },
    { label: '64 fichas (8×8) — brutal', cols: 8, rows: 8 },
];

let ears: EarLibrary;
let sourceImg: HTMLImageElement | null = null;
let sourceName = '';
let lastCut: { res: BrowserCutResult; norm: HTMLCanvasElement } | null = null;
let builtinIds: string[] = [];

async function main(): Promise<void> {
    applyTheme(await (await fetch('config/game.config.json')).json() as GameConfig);
    ears = mergedEars(await (await fetch('config/ears.json')).json());
    builtinIds = await fetch('levels/index.json').then(r => r.json()).then(d => d.levels as string[]).catch(() => []);
    render();
}

function field(label: string, node: Node, hint?: string): HTMLElement {
    return el('div', { class: 'field' }, el('label', {}, label), node,
        hint ? el('div', { class: 'hint' }, hint) : null);
}

function render(): void {
    const host = document.getElementById('app')!;
    host.replaceChildren();

    /* ---------- controles ---------- */

    const idI = el('input', { type: 'text', value: nextId() }) as HTMLInputElement;
    const nameI = el('input', { type: 'text', value: 'Nivel nuevo' }) as HTMLInputElement;

    const presetSel = el('select') as HTMLSelectElement;
    presetSel.append(...PRESETS.map((p, i) =>
        el('option', { value: String(i), ...(i === 2 ? { selected: 'selected' } : {}) }, p.label)));
    const colsI = el('input', { type: 'number', min: '2', max: '12', value: '4' }) as HTMLInputElement;
    const rowsI = el('input', { type: 'number', min: '2', max: '12', value: '4' }) as HTMLInputElement;
    presetSel.addEventListener('change', () => {
        const p = PRESETS[+presetSel.value];
        colsI.value = String(p.cols); rowsI.value = String(p.rows);
        preview();
    });

    const timeI = el('input', { type: 'number', min: '10', step: '10', value: '180' }) as HTMLInputElement;
    const resI = el('select') as HTMLSelectElement;
    resI.append(...[480, 640, 800].map(v =>
        el('option', { value: String(v), ...(v === 640 ? { selected: 'selected' } : {}) }, `${v} px`)));

    const earSel = el('select') as HTMLSelectElement;
    earSel.append(...Object.keys(ears.shapes).map(id =>
        el('option', { value: id, ...(id === ears.default ? { selected: 'selected' } : {}) },
            `${ears.shapes[id].name} (${id})`)));
    earSel.addEventListener('change', preview);

    const tabI = el('input', { type: 'range', min: '0.5', max: '1.4', step: '0.05', value: String(ears.tabRatio) }) as HTMLInputElement;
    const tabOut = el('span', { class: 'tiny dim' }, tabI.value);
    tabI.addEventListener('input', () => { tabOut.textContent = tabI.value; preview(); });

    const tutOn = el('input', { type: 'checkbox' }) as HTMLInputElement;
    const tutTarget = el('select') as HTMLSelectElement;
    tutTarget.append(el('option', { value: 'tip' }, 'Pista'), el('option', { value: 'time' }, '+Tiempo'));
    const tutText = el('textarea', { rows: '3' },
        'Tocá el botón que parpadea para usar el power-up.') as HTMLTextAreaElement;
    const tutAnim = el('select') as HTMLSelectElement;
    tutAnim.append(...['pulse', 'shake', 'bounce'].map(a => el('option', { value: a }, a)));

    const puTip = el('input', { type: 'checkbox', checked: 'checked' }) as HTMLInputElement;
    const puTime = el('input', { type: 'checkbox', checked: 'checked' }) as HTMLInputElement;

    const fileI = el('input', { type: 'file', accept: 'image/*' }) as HTMLInputElement;
    fileI.addEventListener('change', () => {
        const f = fileI.files?.[0];
        if (!f) return;
        const url = URL.createObjectURL(f);
        setImage(url, f.name);
    });

    const sampleSel = el('select') as HTMLSelectElement;
    sampleSel.append(el('option', { value: '' }, '— elegir una de ejemplo —'));
    void fetch('samples/index.json').then(r => r.json()).then((d: { images: string[] }) => {
        sampleSel.append(...d.images.map(n => el('option', { value: n }, n)));
    }).catch(() => { /* sin ejemplos */ });
    sampleSel.addEventListener('change', () => {
        if (sampleSel.value) setImage('samples/' + sampleSel.value, sampleSel.value);
    });

    /* ---------- salida ---------- */

    const canvas = el('canvas', { width: 520, height: 520 }) as HTMLCanvasElement;
    const thumbs = el('div', { class: 'thumbs' });
    const status = el('div', { class: 'hint' }, 'Elegí una imagen para empezar.');
    const cmd = el('div', { class: 'out' });
    const customList = el('div', { class: 'col', style: { gap: '6px' } });

    const view = el('div', { class: 'screen tool' },
        el('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'flex-start' } },
            el('div', {},
                el('h1', {}, 'Editor de niveles'),
                el('div', { class: 'hint' },
                    'La dificultad sale de dos variables: cantidad de fichas y tiempo.'),
            ),
            el('div', { class: 'row', style: { gap: '6px' } },
                el('a', { href: './ears.html', class: 'btn small ghost' }, 'orejas'),
                el('a', { href: './index.html', class: 'btn small ghost' }, '← juego'),
            ),
        ),

        el('div', { class: 'grid2', style: { marginTop: '14px' } },
            el('div', {},
                el('h2', {}, 'Imagen'),
                field('Desde el dispositivo', fileI),
                field('O una de ejemplo', sampleSel),
                field('Resolución del recorte', resI,
                    'Más chico = fichas más livianas para probar en el teléfono.'),

                el('h2', {}, 'Nivel'),
                field('id (nombre de la carpeta)', idI),
                field('nombre visible', nameI),

                el('h2', {}, 'Dificultad'),
                field('Cantidad de fichas', presetSel),
                el('div', { class: 'row' },
                    field('columnas', colsI), field('filas', rowsI)),
                field('Tiempo (segundos)', timeI),

                el('h2', {}, 'Orejas'),
                field('Forma', earSel, 'Las creás en el editor de orejas.'),
                field('Tamaño del diente', el('div', { class: 'row' }, tabI, tabOut)),

                el('h2', {}, 'Power-ups'),
                el('div', { class: 'field inline' }, puTip, el('label', {}, 'Pista disponible')),
                el('div', { class: 'field inline' }, puTime, el('label', {}, '+Tiempo disponible')),

                el('h2', {}, 'Tutorial'),
                el('div', { class: 'field inline' }, tutOn, el('label', {}, 'Este nivel tiene tutorial')),
                field('Botón que se anima', tutTarget),
                field('Animación', tutAnim),
                field('Texto del popup', tutText,
                    'Durante el tutorial queda todo bloqueado menos ese botón; si tocás otra cosa suena el sonido de bloqueado.'),
            ),

            el('div', {},
                el('h2', {}, 'Vista previa'),
                canvas,
                status,
                el('div', { class: 'bar' },
                    el('button', { class: 'btn small primary', onclick: doGenerate }, 'Generar fichas'),
                    el('button', { class: 'btn small', onclick: doTest }, 'Probar en este dispositivo'),
                    el('button', { class: 'btn small', onclick: doZip }, 'Descargar .zip'),
                    el('button', { class: 'btn small ghost', onclick: doRecipe }, 'Descargar receta'),
                ),
                thumbs,
                el('h2', {}, 'Comando de la tool'),
                cmd,
                el('h2', {}, 'Niveles propios en este dispositivo'),
                customList,
            ),
        ),
    );
    host.append(view);

    /* ---------- lógica ---------- */

    function setImage(url: string, name: string): void {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => { sourceImg = i; sourceName = name; preview(); };
        i.onerror = () => { status.textContent = 'No pude abrir esa imagen.'; };
        i.src = url;
    }

    const cols = () => Math.max(2, Math.min(12, +colsI.value || 2));
    const rows = () => Math.max(2, Math.min(12, +rowsI.value || 2));

    function scaledSource(): HTMLCanvasElement {
        const max = +resI.value;
        const s = Math.min(1, max / Math.max(sourceImg!.naturalWidth, sourceImg!.naturalHeight));
        const tmp = document.createElement('canvas');
        tmp.width = Math.round(sourceImg!.naturalWidth * s);
        tmp.height = Math.round(sourceImg!.naturalHeight * s);
        tmp.getContext('2d')!.drawImage(sourceImg!, 0, 0, tmp.width, tmp.height);
        return normalizeSource(tmp, cols(), rows());
    }

    /** Dibuja la imagen con el contorno del corte encima (sin generar PNGs todavía). */
    function preview(): void {
        updateCmd();
        if (!sourceImg) return;
        const norm = scaledSource();
        const size = 520;
        const s = Math.min(size / norm.width, size / norm.height);
        canvas.width = Math.round(norm.width * s);
        canvas.height = Math.round(norm.height * s);
        const g = canvas.getContext('2d')!;
        g.clearRect(0, 0, canvas.width, canvas.height);
        g.drawImage(norm, 0, 0, canvas.width, canvas.height);

        const res = cutPolygons({
            cols: cols(), rows: rows(), imgW: norm.width, imgH: norm.height,
            shape: ears.shapes[earSel.value], tabRatio: +tabI.value, flatten: ears.flatten,
            seed: hashSeed(`${idI.value}:${cols()}x${rows()}`),
        });
        g.strokeStyle = 'rgba(255,255,255,.85)';
        g.lineWidth = 1.5;
        for (const p of res.pieces) {
            g.beginPath();
            p.poly.forEach((q, i) => i ? g.lineTo(q.x * s, q.y * s) : g.moveTo(q.x * s, q.y * s));
            g.closePath();
            g.stroke();
        }
        status.textContent = `${norm.width}×${norm.height} px · ${cols() * rows()} fichas de ` +
            `${Math.round(res.pieceW)}×${Math.round(res.pieceH)} px`;
    }

    function doGenerate(): BrowserCutResult | null {
        if (!sourceImg) { status.textContent = 'Falta la imagen.'; return null; }
        const norm = scaledSource();
        const res = cutImageToPieces(norm, {
            cols: cols(), rows: rows(),
            shape: ears.shapes[earSel.value],
            tabRatio: +tabI.value,
            flatten: ears.flatten,
            seed: hashSeed(`${idI.value}:${cols()}x${rows()}`),
        });
        lastCut = { res, norm };
        thumbs.replaceChildren(...res.pngs.map(p => el('img', { src: p.url, alt: `${p.col},${p.row}` })));
        const kb = res.pngs.reduce((a, p) => a + p.bytes.length, 0) / 1024;
        status.textContent = `${res.pngs.length} fichas generadas · ${kb.toFixed(0)} KB en total`;
        return res;
    }

    function buildLevel(): LevelConfig {
        const res = lastCut!.res;
        const norm = lastCut!.norm;
        const pieces: PieceDef[] = res.pngs.map(p => ({
            col: p.col, row: p.row, file: `pieces/p_${p.col}_${p.row}.png`,
            ox: p.ox, oy: p.oy,
        }));
        return {
            id: idI.value.trim() || nextId(),
            name: nameI.value.trim() || 'Nivel',
            image: 'image.png',
            cols: cols(), rows: rows(),
            timeSec: Math.max(10, +timeI.value || 60),
            ear: earSel.value,
            seed: hashSeed(`${idI.value}:${cols()}x${rows()}`),
            imageW: norm.width, imageH: norm.height,
            cellW: res.cellW, cellH: res.cellH,
            margin: res.margin,
            pieceW: Math.round(res.pieceW), pieceH: Math.round(res.pieceH),
            powerups: { tip: puTip.checked, time: puTime.checked },
            tutorial: tutOn.checked ? {
                enabled: true,
                target: tutTarget.value,
                text: tutText.value,
                anim: tutAnim.value as 'pulse' | 'shake' | 'bounce',
            } : null,
            pieces,
        };
    }

    function doTest(): void {
        if (!lastCut && !doGenerate()) return;
        const level = buildLevel();
        const files: Record<string, string> = { 'image.png': lastCut!.norm.toDataURL('image/png') };
        for (const p of lastCut!.res.pngs) files[`pieces/p_${p.col}_${p.row}.png`] = p.url;
        try {
            saveCustomLevel({ level, files });
        } catch {
            status.textContent = 'No entró en el almacenamiento del navegador: probá con menos resolución.';
            return;
        }
        refreshCustom();
        status.textContent = `Guardado. Abrí el juego: el nivel "${level.name}" queda al final del camino.`;
    }

    function doZip(): void {
        if (!lastCut && !doGenerate()) return;
        const level = buildLevel();
        const entries: ZipEntry[] = [
            { name: `${level.id}/level.json`, data: new TextEncoder().encode(JSON.stringify(level, null, 2)) },
            { name: `${level.id}/image.png`, data: dataUrlBytes(lastCut!.norm.toDataURL('image/png')) },
            ...lastCut!.res.pngs.map(p => ({
                name: `${level.id}/pieces/p_${p.col}_${p.row}.png`, data: p.bytes,
            })),
        ];
        download(makeZip(entries), `nivel-${level.id}.zip`);
        status.textContent = 'Descomprimilo dentro de proto/public/levels/ y agregá el id a levels/index.json.';
    }

    function doRecipe(): void {
        const recipe = {
            id: idI.value.trim(), name: nameI.value.trim(),
            cols: cols(), rows: rows(), timeSec: Math.max(10, +timeI.value || 60),
            ear: earSel.value, tabRatio: +tabI.value,
            tutorial: tutOn.checked
                ? { enabled: true, target: tutTarget.value, text: tutText.value, anim: tutAnim.value }
                : null,
        };
        download(new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' }),
            `nivel-${recipe.id}.recipe.json`);
    }

    function updateCmd(): void {
        const tut = tutOn.checked
            ? ` \\\n    --tutorial ${tutTarget.value} --tutorial-anim ${tutAnim.value} --tutorial-text ${JSON.stringify(tutText.value)}`
            : '';
        cmd.textContent =
            `python3 proto/tools/gen_level.py \\\n` +
            `    --image ${sourceName || 'RUTA/A/TU/IMAGEN.png'} \\\n` +
            `    --id ${idI.value} --name ${JSON.stringify(nameI.value)} \\\n` +
            `    --cols ${cols()} --rows ${rows()} --time ${timeI.value} \\\n` +
            `    --ear ${earSel.value} --tab-ratio ${tabI.value}${tut} \\\n` +
            `    --register`;
    }

    function refreshCustom(): void {
        const ids = customLevelIds();
        customList.replaceChildren(...(ids.length ? ids.map(id =>
            el('div', { class: 'row', style: { gap: '8px' } },
                el('span', { class: 'grow' }, id),
                el('a', { class: 'btn small ghost', href: './index.html' }, 'jugar'),
                el('button', {
                    class: 'btn small ghost',
                    onclick: () => { deleteCustomLevel(id); refreshCustom(); },
                }, 'borrar'),
            )) : [el('div', { class: 'hint' }, 'Todavía no guardaste ninguno.')]));
    }

    for (const n of [idI, nameI, colsI, rowsI, timeI, resI, tutOn, tutText, tutTarget, tutAnim]) {
        n.addEventListener('change', preview);
    }
    refreshCustom();
    updateCmd();
}

function dataUrlBytes(url: string): Uint8Array {
    const bin = atob(url.slice(url.indexOf(',') + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/** Un id libre: no pisa los niveles que vienen en el build ni los ya guardados acá. */
function nextId(): string {
    const used = new Set([...customLevelIds(), ...builtinIds]);
    for (let i = 1; i < 100; i++) {
        const id = String(i).padStart(2, '0');
        if (!used.has(id)) return id;
    }
    return 'nuevo';
}

void main();
