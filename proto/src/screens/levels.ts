/** Mapa de niveles: un camino serpenteante donde los nodos se desbloquean al pasar el anterior. */
import { C, ORDER, ico, m, t, customLevelIds, loadLevel } from '../config';
import { el } from '../core/dom';
import { go } from '../core/router';
import { sfx } from '../core/audio';
import { vibrate } from '../core/haptics';
import { save } from '../core/save';

export async function levelsScreen(host: HTMLElement): Promise<void> {
    const ids = [...ORDER(), ...customLevelIds().filter(id => !ORDER().includes(id))];

    const scroll = el('div', { class: 'map-scroll' });
    const inner = el('div', { class: 'map-inner' });
    scroll.append(inner);

    host.append(el('div', { class: 'screen' },
        el('div', { class: 'topbar' },
            el('button', { class: 'btn small icon ghost', onclick: () => { sfx('back'); void go('menu'); } }, ico('back')),
            el('div', { class: 'grow', style: { fontWeight: '800' } }, t('levels')),
            el('span', { class: 'chip' }, ico('coin'), String(save.data.coins)),
        ),
        scroll,
    ));

    const gap = m('levelNodeGap');
    const amp = m('levelPathAmplitude');
    const pad = m('levelNodeSize');
    const height = gap * ids.length + pad;
    inner.style.height = `${height}px`;

    // el nivel N se desbloquea cuando pasaste el N-1
    const unlockedUpTo = ids.findIndex(id => !save.progress(id));
    const maxIndex = unlockedUpTo === -1 ? ids.length - 1 : unlockedUpTo;

    // los nodos van de abajo (nivel 1) hacia arriba
    const pos = ids.map((_, i) => ({
        xPct: 50 + Math.sin(i * 0.9) * amp * 100,
        y: height - pad / 2 - i * gap,
    }));

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 100 ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pos.map((p, i) =>
        (i === 0 ? 'M' : 'L') + `${p.xPct} ${p.y}`).join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', C().colors.panelAlt);
    path.setAttribute('stroke-width', String(m('levelPathWidth')));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(path);
    inner.append(svg);

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const prog = save.progress(id);
        const locked = i > maxIndex;
        const state = locked ? 'locked' : (prog ? 'done' : 'current');
        const stars = prog ? ico('star').repeat(prog.stars) + ico('starEmpty').repeat(3 - prog.stars) : '';

        const node = el('button', { class: `node ${state}` },
            locked ? ico('lock') : String(i + 1),
            stars && el('span', { class: 'stars' }, stars),
            el('span', { class: 'name' }, ''),
        );
        node.style.left = `${pos[i].xPct}%`;
        node.style.top = `${pos[i].y}px`;

        // el nombre del nivel se lee del level.json (asincrónico, no bloquea el mapa)
        void loadLevel(id).then(lv => {
            const label = node.querySelector('.name')!;
            label.textContent = locked ? t('locked') : `${lv.name} · ${lv.cols * lv.rows} ${t('pieces')}`;
        }).catch(() => { /* nivel roto: lo dejamos sin nombre */ });

        node.addEventListener('click', () => {
            if (locked) { sfx('blocked'); vibrate('blocked'); return; }
            sfx('click'); vibrate('tap');
            void go('game', { id });
        });
        inner.append(node);
    }

    // arrancar mirando el nivel actual
    requestAnimationFrame(() => {
        const target = pos[Math.min(maxIndex, pos.length - 1)];
        scroll.scrollTop = Math.max(0, target.y - scroll.clientHeight * 0.6);
    });
}
