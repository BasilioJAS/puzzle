/** Router de pantallas: cada pantalla se dibuja entera dentro de #app. */
export type ScreenFn = (host: HTMLElement, params?: any) => void | Promise<void>;

const screens = new Map<string, ScreenFn>();
let current = '';

export function register(name: string, fn: ScreenFn): void { screens.set(name, fn); }
export const currentScreen = (): string => current;

export async function go(name: string, params?: any): Promise<void> {
    const fn = screens.get(name);
    if (!fn) throw new Error('pantalla desconocida: ' + name);
    const host = document.getElementById('app')!;
    host.replaceChildren();
    current = name;
    await fn(host, params);
}
