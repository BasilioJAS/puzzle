import { C, ico, t } from '../config';
import { el } from '../core/dom';
import { go } from '../core/router';
import { sfx } from '../core/audio';

export function aboutScreen(host: HTMLElement): void {
    const cfg = C();
    host.append(el('div', { class: 'screen' },
        el('div', { class: 'topbar' },
            el('button', { class: 'btn small icon ghost', onclick: () => { sfx('back'); void go('menu'); } }, ico('back')),
            el('div', { class: 'grow', style: { fontWeight: '800' } }, t('aboutTitle')),
        ),
        el('div', { class: 'panel col', style: { gap: '12px', marginTop: '12px' } },
            el('div', { class: 'logo', style: { fontSize: '56px', textAlign: 'center' } }, ico('logo')),
            el('div', { style: { whiteSpace: 'pre-line', lineHeight: '1.6' } }, t('aboutBody')),
            el('div', { class: 'tiny dim' }, `${cfg.app.title} v${cfg.app.version} — ${t('aboutCredits')}`),
        ),
        el('div', { class: 'links', style: { marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center' } },
            el('a', { href: './editor.html', class: 'btn small ghost' }, t('editorLink')),
            el('a', { href: './ears.html', class: 'btn small ghost' }, t('earsLink')),
        ),
    ));
}
