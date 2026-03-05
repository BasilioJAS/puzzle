import { GameConfig } from '../types/GameTypes';

export class ConfigLoader {
    private config: GameConfig | null = null;

    async load(url: string): Promise<GameConfig> {
        const baseUrl = import.meta.env.BASE_URL;

        const [configRes, curveRes, metaRes] = await Promise.all([
            fetch(url),
            fetch(`${baseUrl}assets/levels_curve.json`).catch(() => null),
            fetch(`${baseUrl}assets/levels_meta.json`).catch(() => null)
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

        if (metaRes && metaRes.ok) {
            try {
                const metaData = await metaRes.json();
                if (this.config.levels) {
                    for (const lvl of this.config.levels) {
                        const meta = metaData[lvl.id.toString()];
                        if (meta) {
                            lvl.cols = meta.cols; // Overrides with actual processed orientation
                            lvl.rows = meta.rows;
                            (lvl as any).cellW_px = meta.cellW_px;
                            (lvl as any).cellH_px = meta.cellH_px;
                        }
                    }
                }
            } catch (e) {
                console.warn("Could not parse levels_meta.json", e);
            }
        }

        if (this.config.levels) {
            for (const lvl of this.config.levels) {
                if (!lvl.piecesFolder) {
                    lvl.piecesFolder = `assets/levels/${lvl.id}/`;
                }
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
