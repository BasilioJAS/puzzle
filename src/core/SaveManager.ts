import { PlayerSave, SettingsConfig } from '../types/GameTypes';

const SAVE_KEY = 'puzzle_quest_save';

export class SaveManager {
    private data: PlayerSave;

    constructor(settings: SettingsConfig) {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved) as PlayerSave;
                // Migrate old saves
                if (parsed.combo === undefined) parsed.combo = 0;
                this.data = parsed;
            } catch {
                this.data = this.createDefault(settings);
            }
        } else {
            this.data = this.createDefault(settings);
        }
    }

    private createDefault(s: SettingsConfig): PlayerSave {
        return {
            unlockedLevel: 1,
            stars: [],
            softCurrency: s.startSoftCurrency,
            hardCurrency: s.startHardCurrency,
            combo: 0,
            powerUps: {},
        };
    }

    save(): void {
        localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    }

    getData(): PlayerSave {
        return this.data;
    }

    // ── Level Progression ──
    getUnlockedLevel(): number {
        return this.data.unlockedLevel;
    }

    unlockNextLevel(currentLevel: number): void {
        if (currentLevel >= this.data.unlockedLevel) {
            this.data.unlockedLevel = currentLevel + 1;
        }
        this.save();
    }

    setStars(levelId: number, stars: number): void {
        while (this.data.stars.length < levelId) this.data.stars.push(0);
        this.data.stars[levelId - 1] = Math.max(this.data.stars[levelId - 1] || 0, stars);
        this.save();
    }

    completeLevel(levelId: number, stars: number): void {
        this.setStars(levelId, stars);
        this.unlockNextLevel(levelId);
        this.incrementCombo();
    }

    getNextUncompletedLevel(): number {
        return this.data.unlockedLevel;
    }

    getStars(levelId: number): number {
        return this.data.stars[levelId - 1] || 0;
    }

    // ── Currency ──
    getSoftCurrency(): number {
        return this.data.softCurrency;
    }

    getHardCurrency(): number {
        return this.data.hardCurrency;
    }

    addSoftCurrency(amount: number): void {
        this.data.softCurrency += amount;
        this.save();
    }

    addHardCurrency(amount: number): void {
        this.data.hardCurrency += amount;
        this.save();
    }

    spendSoft(amount: number): boolean {
        if (this.data.softCurrency < amount) return false;
        this.data.softCurrency -= amount;
        this.save();
        return true;
    }

    spendHard(amount: number): boolean {
        if (this.data.hardCurrency < amount) return false;
        this.data.hardCurrency -= amount;
        this.save();
        return true;
    }

    // ── Combo ──
    getCombo(): number {
        return this.data.combo;
    }

    incrementCombo(): void {
        this.data.combo = Math.min(5, this.data.combo + 1);
        this.save();
    }

    resetCombo(): void {
        this.data.combo = 0;
        this.save();
    }

    // ── Power-ups ──
    getPowerUpCount(id: string): number {
        return this.data.powerUps[id] || 0;
    }

    addPowerUp(id: string, count: number = 1): void {
        this.data.powerUps[id] = (this.data.powerUps[id] || 0) + count;
        this.save();
    }

    usePowerUp(id: string): boolean {
        if ((this.data.powerUps[id] || 0) <= 0) return false;
        this.data.powerUps[id]--;
        this.save();
        return true;
    }
}
