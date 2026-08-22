/** Progreso y ajustes en localStorage. */
import { C } from '../config';

export interface LevelProgress { stars: number; bestLeft: number; }

export interface SaveData {
    coins: number;
    powerups: Record<string, number>;
    levels: Record<string, LevelProgress>;
    settings: { music: boolean; sfx: boolean; vibration: boolean };
    tutorialsSeen: string[];
}

function fresh(): SaveData {
    const cfg = C();
    const pu: Record<string, number> = {};
    for (const id of cfg.powerups.order) pu[id] = cfg.powerups[id].startCount;
    return {
        coins: cfg.shop.startCoins,
        powerups: pu,
        levels: {},
        settings: {
            music: cfg.audio.musicEnabledDefault,
            sfx: cfg.audio.sfxEnabledDefault,
            vibration: cfg.haptics.enabledDefault,
        },
        tutorialsSeen: [],
    };
}

class Save {
    data!: SaveData;

    load(): void {
        const def = fresh();
        try {
            const raw = localStorage.getItem(C().storageKey);
            this.data = raw ? { ...def, ...JSON.parse(raw) } : def;
            this.data.settings = { ...def.settings, ...this.data.settings };
            this.data.powerups = { ...def.powerups, ...this.data.powerups };
        } catch {
            this.data = def;
        }
    }

    flush(): void {
        try { localStorage.setItem(C().storageKey, JSON.stringify(this.data)); } catch { /* modo privado */ }
    }

    reset(): void { this.data = fresh(); this.flush(); }

    progress(id: string): LevelProgress | null { return this.data.levels[id] ?? null; }

    /** Marca el nivel como pasado y devuelve las monedas ganadas. */
    clearLevel(id: string, stars: number, timeLeft: number): number {
        const cfg = C();
        const prev = this.data.levels[id];
        let coins = stars * cfg.rewards.coinsPerStar;
        if (!prev) coins += cfg.rewards.coinsFirstClear;
        this.data.levels[id] = {
            stars: Math.max(stars, prev?.stars ?? 0),
            bestLeft: Math.max(timeLeft, prev?.bestLeft ?? 0),
        };
        this.data.coins += coins;
        this.flush();
        return coins;
    }

    spend(n: number): boolean {
        if (this.data.coins < n) return false;
        this.data.coins -= n;
        this.flush();
        return true;
    }

    addPowerup(id: string, n: number): void {
        this.data.powerups[id] = (this.data.powerups[id] ?? 0) + n;
        this.flush();
    }

    usePowerup(id: string): boolean {
        if ((this.data.powerups[id] ?? 0) <= 0) return false;
        this.data.powerups[id]--;
        this.flush();
        return true;
    }

    markTutorial(id: string): void {
        if (!this.data.tutorialsSeen.includes(id)) {
            this.data.tutorialsSeen.push(id);
            this.flush();
        }
    }

    sawTutorial(id: string): boolean { return this.data.tutorialsSeen.includes(id); }
}

export const save = new Save();
