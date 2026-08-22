/** Helpers mínimos de DOM: sin framework, es un prototipo. */

type Kids = (Node | string | null | undefined | false)[];

export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Partial<Record<string, any>> = {},
    ...kids: Kids
): HTMLElementTagNameMap[K] {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') n.className = String(v);
        else if (k === 'style') Object.assign(n.style, v);
        else if (k === 'html') n.innerHTML = String(v);
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
        else n.setAttribute(k, String(v));
    }
    for (const c of kids.flat()) {
        if (c === null || c === undefined || c === false) continue;
        n.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
}

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
    root.querySelector<T>(sel);

export function clear(node: Element): void { while (node.firstChild) node.removeChild(node.firstChild); }

export function mmss(sec: number): string {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('no cargó ' + src));
        i.src = src;
    });
}
