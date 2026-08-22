import { C, ico, t, m } from '../config';
import { el } from '../core/dom';
import { go } from '../core/router';
import { unlockAudio, refreshMusic, sfx } from '../core/audio';

export function splashScreen(host: HTMLElement): void {
    const cfg = C();
    const bar = el('i');
    const hint = el('div', { class: 'dim blink' }, t('loading'));

    const view = el('div', { class: 'screen splash' },
        el('div', { class: 'logo' }, ico('logo')),
        el('div', { class: 'title' }, cfg.app.title),
        el('div', { class: 'tiny dim' }, `${cfg.app.subtitle} · v${cfg.app.version}`),
        el('div', { class: 'bar' }, bar),
        hint,
    );
    host.append(view);

    // barra de carga puramente cosmética: los assets ya están en el config
    const start = performance.now();
    const minMs = m('splashMinMs');
    const tick = () => {
        const p = Math.min(1, (performance.now() - start) / minMs);
        bar.style.width = `${p * 100}%`;
        if (p < 1) requestAnimationFrame(tick);
        else ready();
    };
    requestAnimationFrame(tick);

    function ready() {
        hint.textContent = t('tapToStart');
        const enter = () => {
            view.removeEventListener('pointerdown', enter);
            unlockAudio();      // hace falta un gesto del usuario para el audio
            refreshMusic();
            sfx('click');
            void go('menu');
        };
        view.addEventListener('pointerdown', enter);
    }
}
