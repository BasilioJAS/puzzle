import { C, ico, t } from '../config';
import { el } from '../core/dom';
import { go } from '../core/router';
import { refreshMusic, sfx } from '../core/audio';
import { vibrate, canVibrate } from '../core/haptics';
import { save } from '../core/save';

function toggle(iconKey: string, labelKey: string, get: () => boolean, set: (v: boolean) => void, supported = true) {
    const b = el('button', { class: 'toggle' },
        el('span', { class: 'ico' }, ico(iconKey)),
        el('span', {}, t(labelKey)),
    );
    const paint = () => {
        b.className = 'toggle ' + (get() ? 'on' : 'off');
        if (!supported) b.classList.add('off');
    };
    b.addEventListener('click', () => {
        set(!get());
        save.flush();
        paint();
        sfx('click');
        vibrate('tap');
        refreshMusic();
    });
    paint();
    return b;
}

export function menuScreen(host: HTMLElement): void {
    const cfg = C();
    const s = save.data.settings;

    host.append(el('div', { class: 'screen menu' },
        el('div', { class: 'brand col center' },
            el('div', { class: 'logo' }, ico('logo')),
            el('div', { class: 'title' }, cfg.app.title),
            el('div', { class: 'row', style: { gap: '6px', marginTop: '6px' } },
                el('span', { class: 'chip' }, ico('coin'), String(save.data.coins)),
            ),
        ),
        el('button', { class: 'btn primary', onclick: () => { sfx('click'); vibrate('tap'); void go('levels'); } },
            ico('play'), t('play')),
        el('button', { class: 'btn', onclick: () => { sfx('click'); vibrate('tap'); void go('shop'); } },
            ico('shop'), t('shop')),
        el('button', { class: 'btn ghost', onclick: () => { sfx('click'); vibrate('tap'); void go('about'); } },
            ico('about'), t('about')),

        el('div', { class: 'toggles' },
            toggle('music', 'music', () => s.music, v => s.music = v),
            toggle('sfx', 'sfx', () => s.sfx, v => s.sfx = v),
            toggle('vibration', 'vibration', () => s.vibration, v => s.vibration = v, canVibrate()),
        ),

        el('div', { class: 'links' },
            el('a', { href: './editor.html' }, t('editorLink')),
            el('a', { href: './ears.html' }, t('earsLink')),
        ),
    ));
}
