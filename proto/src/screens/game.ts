/**
 * Pantalla de juego.
 *
 * El tablero y la bandeja se dibujan en un único canvas (así el hit-test puede
 * mirar el alfa real de cada ficha PNG); la HUD, los power-ups y el tutorial son DOM.
 */
import {
    C, ORDER, ico, m, t, customLevelIds,
    loadLevel, levelAsset, type LevelConfig, type PieceDef,
} from '../config';
import { alphaMask, el, loadImage, mmss } from '../core/dom';
import { go } from '../core/router';
import { sfx } from '../core/audio';
import { vibrate } from '../core/haptics';
import { save } from '../core/save';

interface Piece {
    def: PieceDef;
    img: HTMLImageElement;
    mask: { w: number; h: number; data: Uint8Array };
    placed: boolean;
    /** posición actual del vértice superior izquierdo, en px de canvas */
    x: number;
    y: number;
    /** escala aplicada a la imagen de la ficha */
    s: number;
    flashUntil: number;
}

interface Rect { x: number; y: number; w: number; h: number; }

export async function gameScreen(host: HTMLElement, params: { id: string }): Promise<void> {
    const cfg = C();
    const level: LevelConfig = await loadLevel(params.id);

    // ---------- assets ----------
    const [full, ...pieceImgs] = await Promise.all([
        loadImage(levelAsset(level, level.image)),
        ...level.pieces.map(p => loadImage(levelAsset(level, p.file))),
    ]);

    const pieces: Piece[] = level.pieces.map((def, i) => ({
        def,
        img: pieceImgs[i],
        mask: alphaMask(pieceImgs[i]),
        placed: false,
        x: 0, y: 0, s: 1,
        flashUntil: 0,
    }));

    // ---------- DOM ----------
    const clock = el('span', { class: 'chip' }, ico('clock'), mmss(level.timeSec));
    const canvas = el('canvas');
    const playArea = el('div', { class: 'play-area' }, canvas);
    const puBar = el('div', { class: 'pu-bar' });

    const view = el('div', { class: 'screen game' },
        el('div', { class: 'topbar' },
            el('button', { class: 'btn small icon ghost', onclick: () => quit() }, ico('back')),
            el('div', { class: 'col grow' },
                el('div', { style: { fontWeight: '800' } }, level.name),
                el('div', { class: 'tiny dim' }, `${level.cols * level.rows} ${t('pieces')}`),
            ),
            clock,
        ),
        playArea,
        puBar,
    );
    host.append(view);

    // ---------- power-ups ----------
    const puButtons = new Map<string, HTMLButtonElement>();
    for (const id of cfg.powerups.order) {
        if (level.powerups && level.powerups[id] === false) continue;
        const pu = cfg.powerups[id];
        const count = el('span', { class: 'count' }, String(save.data.powerups[id] ?? 0));
        const b = el('button', { class: 'pu', title: t(pu.labelKey) },
            ico(pu.icon), count) as HTMLButtonElement;
        b.addEventListener('click', () => usePowerUp(id));
        puButtons.set(id, b);
        puBar.append(b);
    }
    const refreshPowerUps = () => {
        for (const [id, b] of puButtons) {
            const n = save.data.powerups[id] ?? 0;
            b.querySelector('.count')!.textContent = String(n);
            if (n <= 0 && !tutorial.active) b.setAttribute('disabled', '');
            else b.removeAttribute('disabled');
        }
    };

    // ---------- layout ----------
    const g = canvas.getContext('2d')!;
    let dpr = 1, cw = 0, ch = 0;
    let board: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let tray: Rect = { x: 0, y: 0, w: 0, h: 0 };
    let boardScale = 1, trayScale = 1, trayScroll = 0, trayContent = 0;
    /** en apaisado la bandeja va a la derecha en vez de abajo */
    let trayVertical = false;

    function layout(): void {
        const r = playArea.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        cw = r.width; ch = r.height;
        canvas.width = Math.round(cw * dpr);
        canvas.height = Math.round(ch * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);

        const pad = m('boardPadding');
        trayVertical = cw > ch * m('landscapeAspect');

        let availW: number, availH: number;
        if (trayVertical) {
            const trayW = Math.max(80, cw * m('trayWidthRatio'));
            tray = { x: cw - trayW, y: 0, w: trayW, h: ch };
            availW = cw - trayW - pad * 2;
            availH = ch - pad * 2;
        } else {
            const trayH = Math.max(70, ch * m('trayHeightRatio'));
            tray = { x: 0, y: ch - trayH, w: cw, h: trayH };
            availW = cw - pad * 2;
            availH = ch - trayH - pad * 2;
        }
        boardScale = Math.min(availW / level.imageW, availH / level.imageH);
        const bw = level.imageW * boardScale, bh = level.imageH * boardScale;
        board = {
            x: pad + (availW - bw) / 2,
            y: pad + (availH - bh) / 2,
            w: bw, h: bh,
        };

        const gap = m('trayGap');
        const across = (trayVertical ? tray.w : tray.h) - gap * 2;
        const fit = Math.min(m('trayPieceMax'), across);
        trayScale = fit / Math.max(level.pieceW, level.pieceH);

        relayoutTray();
        for (const p of pieces) if (p.placed) snapToBoard(p);
    }

    function relayoutTray(): void {
        const gap = m('trayGap');
        // el slot se mide por la celda (no por la imagen, que trae los márgenes
        // de las orejas): así las fichas quedan juntas como en una bandeja real
        const slot = (trayVertical ? level.cellH : level.cellW) * trayScale + gap;
        const loose = pieces.filter(p => !p.placed);
        trayContent = Math.max(0, loose.length * slot - gap);
        const along = trayVertical ? tray.h : tray.w;
        const start = Math.max(gap, (along - trayContent) / 2);
        const inset = level.margin * trayScale;
        loose.forEach((p, i) => {
            if (p === dragging) return;
            p.s = trayScale;
            if (trayVertical) {
                p.x = tray.x + (tray.w - level.pieceW * trayScale) / 2;
                p.y = tray.y + start + i * slot - inset - trayScroll;
            } else {
                p.x = start + i * slot - inset - trayScroll;
                p.y = tray.y + (tray.h - level.pieceH * trayScale) / 2;
            }
        });
        const maxScroll = Math.max(0, trayContent + gap * 2 - along);
        trayScroll = Math.min(Math.max(0, trayScroll), maxScroll);
    }

    function snapToBoard(p: Piece): void {
        p.s = boardScale;
        p.x = board.x + p.def.ox * boardScale;
        p.y = board.y + p.def.oy * boardScale;
    }

    // ---------- orden inicial de la bandeja ----------
    shuffle(pieces, level.seed);

    // ---------- input ----------
    let dragging: Piece | null = null;
    let dragDX = 0, dragDY = 0;
    let mode: 'none' | 'undecided' | 'drag' | 'scroll' = 'none';
    let downX = 0, downY = 0, scrollStart = 0;
    let candidate: Piece | null = null;

    const toCanvas = (e: PointerEvent) => {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const inTray = (x: number, y: number): boolean =>
        x >= tray.x && x <= tray.x + tray.w && y >= tray.y && y <= tray.y + tray.h;

    function hitPiece(x: number, y: number): Piece | null {
        // de adelante hacia atrás: la última dibujada es la de arriba
        for (let i = pieces.length - 1; i >= 0; i--) {
            const p = pieces[i];
            if (p.placed) continue;
            const w = level.pieceW * p.s, h = level.pieceH * p.s;
            if (x < p.x || y < p.y || x > p.x + w || y > p.y + h) continue;
            const mx = Math.floor(((x - p.x) / w) * p.mask.w);
            const my = Math.floor(((y - p.y) / h) * p.mask.h);
            if (p.mask.data[my * p.mask.w + mx] > 40) return p;
        }
        return null;
    }

    canvas.addEventListener('pointerdown', e => {
        if (over || tutorial.active || paused) return;
        canvas.setPointerCapture(e.pointerId);
        const { x, y } = toCanvas(e);
        downX = x; downY = y;
        candidate = hitPiece(x, y);
        if (candidate) { mode = 'undecided'; }
        else if (inTray(x, y)) { mode = 'scroll'; scrollStart = trayScroll; }
        else mode = 'none';
    });

    canvas.addEventListener('pointermove', e => {
        if (mode === 'none') return;
        const { x, y } = toCanvas(e);
        const dx = x - downX, dy = y - downY;

        if (mode === 'undecided') {
            if (Math.hypot(dx, dy) < 8) return;
            // gesto en el eje de la bandeja = scroll; el resto = agarrar ficha
            const alongTray = trayVertical ? Math.abs(dy) > Math.abs(dx) * 1.4
                                           : Math.abs(dx) > Math.abs(dy) * 1.4;
            if (inTray(candidate!.x, candidate!.y) && alongTray) {
                mode = 'scroll'; scrollStart = trayScroll;
            } else {
                mode = 'drag';
                dragging = candidate;
                pieces.splice(pieces.indexOf(dragging!), 1);
                pieces.push(dragging!);
                dragging!.s = boardScale * m('pickScale');
                const w = level.pieceW * dragging!.s, h = level.pieceH * dragging!.s;
                dragDX = -w / 2;
                dragDY = -h * 0.62;   // que el dedo no tape la ficha
                sfx('pick'); vibrate('tap');
            }
        }

        if (mode === 'scroll') {
            trayScroll = scrollStart - (trayVertical ? dy : dx);
            relayoutTray();
        } else if (mode === 'drag' && dragging) {
            dragging.x = x + dragDX;
            dragging.y = y + dragDY;
        }
    });

    const endDrag = () => {
        if (mode === 'drag' && dragging) drop(dragging);
        dragging = null; candidate = null; mode = 'none';
        relayoutTray();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    function drop(p: Piece): void {
        // la comparación se hace con la ficha ya a escala de tablero
        const w = level.pieceW * p.s, h = level.pieceH * p.s;
        const cx = p.x + w / 2, cy = p.y + h / 2;
        const targetX = board.x + (p.def.ox + level.pieceW / 2) * boardScale;
        const targetY = board.y + (p.def.oy + level.pieceH / 2) * boardScale;
        const radius = Math.min(level.cellW, level.cellH) * boardScale * m('snapRadiusRatio');
        if (Math.hypot(cx - targetX, cy - targetY) <= radius) {
            place(p);
        } else {
            sfx('wrong'); vibrate('wrong');
        }
    }

    function place(p: Piece, silent = false): void {
        p.placed = true;
        snapToBoard(p);
        p.flashUntil = performance.now() + 260;
        // las colocadas van al fondo para que las sueltas queden por encima
        pieces.splice(pieces.indexOf(p), 1);
        pieces.unshift(p);
        if (!silent) { sfx('snap'); vibrate('snap'); }
        if (pieces.every(q => q.placed)) win();
    }

    // ---------- power-ups ----------
    function usePowerUp(id: string): void {
        if (over) return;
        if (tutorial.active && tutorial.target !== id) { blocked(); return; }
        const pu = cfg.powerups[id];
        if ((save.data.powerups[id] ?? 0) <= 0) {
            sfx('wrong'); vibrate('wrong'); toast(t('puNone'));
            if (tutorial.active) endTutorial();
            return;
        }
        save.usePowerup(id);
        sfx('powerup'); vibrate('snap');

        if (id === 'tip') {
            const loose = pieces.filter(p => !p.placed);
            if (loose.length) {
                const target = loose[0];
                if (pu.autoPlace) place(target, true);
                target.flashUntil = performance.now() + (pu.highlightMs ?? 1200);
            }
        } else if (id === 'time') {
            timeLeft += pu.addSeconds ?? 30;
            toast(t('timeAdded', { n: pu.addSeconds ?? 30 }));
        }

        refreshPowerUps();
        if (tutorial.active) endTutorial();
    }

    // ---------- tutorial ----------
    const tutorial = { active: false, target: '' };
    let tutNodes: HTMLElement[] = [];

    function blocked(): void { sfx('blocked'); vibrate('blocked'); }

    function startTutorial(): void {
        const tut = level.tutorial;
        if (!tut?.enabled || save.sawTutorial(level.id)) return;
        const btn = puButtons.get(tut.target);
        if (!btn) return;

        tutorial.active = true;
        tutorial.target = tut.target;
        btn.removeAttribute('disabled');
        btn.classList.add('tut-target', 'anim-' + (tut.anim || 'pulse'));

        // capa que bloquea todo menos el botón marcado
        const block = el('div', { class: 'tut-block' });
        block.addEventListener('pointerdown', ev => { ev.preventDefault(); blocked(); });

        const pop = el('div', { class: 'tut-pop' },
            el('div', { style: { fontSize: '34px' } }, ico(cfg.powerups[tut.target].icon)),
            el('div', { style: { lineHeight: '1.5' } }, tut.text),
            el('button', { class: 'btn small primary', onclick: () => { sfx('click'); pop.remove(); } }, t('tutorialNext')),
        );
        // el popup se ubica arriba de la barra de power-ups
        pop.style.bottom = `${puBar.offsetHeight + 24}px`;

        view.append(block, pop);
        tutNodes = [block, pop];
        refreshPowerUps();
    }

    function endTutorial(): void {
        tutorial.active = false;
        save.markTutorial(level.id);
        for (const n of tutNodes) n.remove();
        tutNodes = [];
        for (const b of puButtons.values()) b.className = 'pu';
        refreshPowerUps();
    }

    // ---------- reloj ----------
    let timeLeft = level.timeSec;
    let over = false;
    let paused = false;
    let last = performance.now();

    function tickClock(dt: number): void {
        if (over || paused || tutorial.active) return;
        timeLeft -= dt;
        clock.replaceChildren(document.createTextNode(`${ico('clock')} ${mmss(timeLeft)}`));
        clock.className = timeLeft <= 15 ? 'chip warn' : 'chip';
        if (timeLeft <= 0) lose();
    }

    // ---------- fin de partida ----------
    function starsFor(): number {
        const frac = Math.max(0, timeLeft) / level.timeSec;
        const th = cfg.gameplay.starThresholds;
        if (frac >= th[0]) return 3;
        if (frac >= th[1]) return 2;
        return 1;
    }

    function win(): void {
        if (over) return;
        over = true;
        sfx('win'); vibrate('win');
        const stars = starsFor();
        const coins = save.clearLevel(level.id, stars, Math.max(0, timeLeft));
        const all = [...ORDER(), ...customLevelIds().filter(x => !ORDER().includes(x))];
        const next = all[all.indexOf(level.id) + 1];
        showOverlay(t('win'),
            el('div', { class: 'stars-big' },
                ...[0, 1, 2].map(i => el('span', { class: i < stars ? '' : 'off' }, i < stars ? ico('star') : ico('starEmpty')))),
            el('div', { class: 'chip', style: { alignSelf: 'center' } }, ico('coin'), `+${coins}`),
            next
                ? el('button', { class: 'btn primary', onclick: () => { sfx('click'); void go('game', { id: next }); } }, t('nextLevel'), ico('next'))
                : null,
            el('button', { class: 'btn', onclick: () => { sfx('click'); void go('game', { id: level.id }); } }, ico('restart'), t('retry')),
            el('button', { class: 'btn ghost', onclick: () => { sfx('back'); void go('levels'); } }, t('toMap')),
        );
    }

    function lose(): void {
        if (over) return;
        over = true;
        timeLeft = 0;
        sfx('lose'); vibrate('lose');
        showOverlay(t('lose'),
            el('div', { class: 'dim' }, `${pieces.filter(p => p.placed).length}/${pieces.length} ${t('pieces')}`),
            el('button', { class: 'btn primary', onclick: () => { sfx('click'); void go('game', { id: level.id }); } }, ico('restart'), t('retry')),
            el('button', { class: 'btn ghost', onclick: () => { sfx('back'); void go('levels'); } }, t('toMap')),
        );
    }

    function showOverlay(title: string, ...content: (Node | null)[]): void {
        view.append(el('div', { class: 'overlay' },
            el('div', { class: 'card' }, el('div', { class: 'title' }, title), ...content),
        ));
    }

    function quit(): void {
        if (tutorial.active) { blocked(); return; }
        sfx('back');
        void go('levels');
    }

    function toast(msg: string): void {
        const n = el('div', { class: 'toast' }, msg);
        view.append(n);
        setTimeout(() => n.remove(), 1400);
    }

    // ---------- render ----------
    function draw(now: number): void {
        g.clearRect(0, 0, cw, ch);

        // tablero
        g.save();
        g.fillStyle = cfg.colors.panel;
        roundRect(g, board.x, board.y, board.w, board.h, m('radiusSmall'));
        g.fill();
        if (cfg.gameplay.showGhostImage) {
            g.globalAlpha = cfg.gameplay.ghostAlpha;
            g.drawImage(full, board.x, board.y, board.w, board.h);
            g.globalAlpha = 1;
        }
        g.strokeStyle = cfg.colors.boardGrid;
        g.lineWidth = 1;
        for (let c = 1; c < level.cols; c++) {
            const x = board.x + c * level.cellW * boardScale;
            g.beginPath(); g.moveTo(x, board.y); g.lineTo(x, board.y + board.h); g.stroke();
        }
        for (let r = 1; r < level.rows; r++) {
            const y = board.y + r * level.cellH * boardScale;
            g.beginPath(); g.moveTo(board.x, y); g.lineTo(board.x + board.w, y); g.stroke();
        }
        g.restore();

        // bandeja
        g.save();
        g.fillStyle = cfg.colors.bgAlt;
        roundRect(g, tray.x + (trayVertical ? 0 : 4), tray.y + (trayVertical ? 4 : 0),
                  tray.w - (trayVertical ? 4 : 8), tray.h - (trayVertical ? 8 : 0), m('radiusSmall'));
        g.fill();
        g.clip();
        for (const p of pieces) if (!p.placed && p !== dragging) drawPiece(g, p, now);
        g.restore();

        // fichas ya colocadas
        for (const p of pieces) if (p.placed) drawPiece(g, p, now);
        // la que se está arrastrando siempre arriba de todo
        if (dragging) drawPiece(g, dragging, now);

        requestAnimationFrame(frame);
    }

    function drawPiece(ctx: CanvasRenderingContext2D, p: Piece, now: number): void {
        const w = level.pieceW * p.s, h = level.pieceH * p.s;
        ctx.save();
        if (cfg.gameplay.pieceShadow && (p === dragging || !p.placed)) {
            ctx.shadowColor = 'rgba(0,0,0,.45)';
            ctx.shadowBlur = p === dragging ? 18 : 6;
            ctx.shadowOffsetY = p === dragging ? 8 : 2;
        }
        ctx.drawImage(p.img, p.x, p.y, w, h);
        ctx.restore();
        if (p.flashUntil > now) {
            ctx.save();
            ctx.globalAlpha = ((p.flashUntil - now) / 400) % 1 * 0.55;
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(p.img, p.x, p.y, w, h);
            ctx.restore();
        }
    }

    function frame(now: number): void {
        if (!view.isConnected) return;      // salimos de la pantalla: cortamos el loop
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        tickClock(dt);
        draw(now);
    }

    // ---------- arranque ----------
    const onResize = () => layout();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    const ro = new ResizeObserver(() => layout());
    ro.observe(playArea);

    // ayuda para probar desde afuera (consola del navegador / tests)
    (window as any).__puzzle = {
        level, pieces,
        rects: () => ({ board, tray, boardScale, trayScale }),
        place: (col: number, row: number) => {
            const p = pieces.find(q => q.def.col === col && q.def.row === row);
            if (p && !p.placed) place(p);
        },
        state: () => ({ placed: pieces.filter(p => p.placed).length, total: pieces.length, timeLeft, over }),
    };

    requestAnimationFrame(() => {
        layout();
        refreshPowerUps();
        startTutorial();
        last = performance.now();
        requestAnimationFrame(frame);
    });

    // limpieza cuando la pantalla se desmonta
    const mo = new MutationObserver(() => {
        if (!view.isConnected) {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            ro.disconnect();
            mo.disconnect();
        }
    });
    mo.observe(host, { childList: true });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
}

/** Barajado determinístico para que el nivel arranque siempre igual. */
function shuffle<T>(arr: T[], seed: number): void {
    let a = seed >>> 0;
    const rand = () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let x = Math.imul(a ^ (a >>> 15), 1 | a);
        x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
