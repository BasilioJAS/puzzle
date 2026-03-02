import { GameConfig } from '../types/GameTypes';

export class ConfigLoader {
    private config: GameConfig | null = null;

    async load(url: string): Promise<GameConfig> {
        const baseUrl = import.meta.env.BASE_URL;

        const [configRes, curveRes] = await Promise.all([
            fetch(url),
            fetch(`${baseUrl}assets/levels_curve.json`).catch(() => null)
        ]);

        if (!configRes.ok) {
            throw new Error(`Failed to load config: ${configRes.statusText}`);
        }

        this.config = await configRes.json() as GameConfig;

        if (curveRes && curveRes.ok) {
            try {
                const curveData = await curveRes.json();
                if (Array.isArray(curveData)) {
                    this.config.levels = curveData;
                }
            } catch (e) {
                console.warn("Could not parse levels_curve.json", e);
            }
        }

        return this.config;
    }

    getConfig(): GameConfig {
        if (!this.config) throw new Error('Config not loaded yet');
        return this.config;
    }

    getText(key: string, lang: string = 'en'): string {
        const loc = this.config?.localization[lang];
        return loc?.[key] ?? key;
    }
}
