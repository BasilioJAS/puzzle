import './style.css';
import { loadBundle } from './config';
import { save } from './core/save';
import { register, go } from './core/router';
import { splashScreen } from './screens/splash';
import { menuScreen } from './screens/menu';
import { levelsScreen } from './screens/levels';
import { gameScreen } from './screens/game';
import { shopScreen } from './screens/shop';
import { aboutScreen } from './screens/about';

async function boot(): Promise<void> {
    const host = document.getElementById('app')!;
    try {
        await loadBundle();
        save.load();

        register('splash', splashScreen);
        register('menu', menuScreen);
        register('levels', levelsScreen);
        register('game', gameScreen);
        register('shop', shopScreen);
        register('about', aboutScreen);

        await go('splash');
    } catch (err) {
        host.innerHTML = `<div class="screen" style="padding:24px">
            <h1>Error al arrancar</h1>
            <pre class="out">${String(err)}</pre></div>`;
        throw err;
    }
}

// evita el zoom por doble tap en iOS
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

void boot();
