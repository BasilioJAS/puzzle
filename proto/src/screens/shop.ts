import { C, ico, t } from '../config';
import { el } from '../core/dom';
import { go } from '../core/router';
import { sfx } from '../core/audio';
import { vibrate } from '../core/haptics';
import { save } from '../core/save';

export function shopScreen(host: HTMLElement): void {
    const cfg = C();
    const coinsChip = el('span', { class: 'chip' }, ico('coin'), String(save.data.coins));
    const list = el('div', { class: 'shop-list' });
    const view = el('div', { class: 'screen' },
        el('div', { class: 'topbar' },
            el('button', { class: 'btn small icon ghost', onclick: () => { sfx('back'); void go('menu'); } }, ico('back')),
            el('div', { class: 'grow', style: { fontWeight: '800' } }, t('shop')),
            coinsChip,
        ),
        el('div', { class: 'tiny dim', style: { padding: '6px 2px' } }, t('shopHint')),
        list,
    );
    host.append(view);

    const toast = (msg: string) => {
        const n = el('div', { class: 'toast' }, msg);
        view.append(n);
        setTimeout(() => n.remove(), 1400);
    };

    const repaint = () => {
        coinsChip.replaceChildren(document.createTextNode(ico('coin') + ' ' + save.data.coins));
        list.replaceChildren(...cfg.shop.items.map(item => {
            const pu = cfg.powerups[item.id];
            const btn = el('button', { class: 'btn small primary' }, `${item.price} ${ico('coin')}`);
            btn.addEventListener('click', () => {
                if (!save.spend(item.price)) { sfx('wrong'); vibrate('wrong'); toast(t('noCoins')); return; }
                save.addPowerup(item.id, item.amount);
                sfx('coin'); vibrate('snap');
                toast(t('bought'));
                repaint();
            });
            if (save.data.coins < item.price) btn.setAttribute('disabled', '');
            return el('div', { class: 'shop-item' },
                el('span', { class: 'ico' }, ico(item.icon)),
                el('div', { class: 'col grow' },
                    el('div', { style: { fontWeight: '700' } }, `${t(pu.labelKey)} ×${item.amount}`),
                    el('div', { class: 'tiny dim' }, `${t('have')} ${save.data.powerups[item.id] ?? 0}`),
                ),
                btn,
            );
        }));
    };
    repaint();
}
