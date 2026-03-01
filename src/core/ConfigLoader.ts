import { GameConfig } from '../types/GameTypes';

export class ConfigLoader {
    private config: GameConfig | null = null;

    async load(url: string): Promise<GameConfig> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.statusText}`);
        }
        this.config = await response.json() as GameConfig;
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
