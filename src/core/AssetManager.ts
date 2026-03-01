export class AssetManager {
    private images: Map<string, HTMLImageElement> = new Map();
    private sounds: Map<string, HTMLAudioElement> = new Map();
    private totalAssets: number = 0;
    private loadedAssets: number = 0;

    initAudio(): void {
        // No-op for HTMLAudioElement, but kept for compatibility
    }

    get progress(): number {
        return this.totalAssets === 0 ? 0 : this.loadedAssets / this.totalAssets;
    }

    get isComplete(): boolean {
        return this.totalAssets > 0 && this.loadedAssets >= this.totalAssets;
    }

    async loadImagesAndSounds(imageMap: Record<string, string>, soundMap: Record<string, string>): Promise<void> {
        this.initAudio();
        const imgEntries = Object.entries(imageMap || {});
        const sndEntries = Object.entries(soundMap || {});
        this.totalAssets = imgEntries.length + sndEntries.length;
        this.loadedAssets = 0;

        const imgPromises = imgEntries.map(([key, url]) => this.loadImage(key, url));
        const sndPromises = sndEntries.map(([key, url]) => this.loadSound(key, url));
        await Promise.all([...imgPromises, ...sndPromises]);
    }

    private loadImage(key: string, url: string): Promise<void> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.images.set(key, img);
                this.loadedAssets++;
                resolve();
            };
            img.onerror = () => {
                // Create a placeholder colored rectangle
                console.warn(`Failed to load image: ${key} (${url}), using placeholder`);
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const c = canvas.getContext('2d')!;
                // Generate a deterministic color from key
                let hash = 0;
                for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffffff;
                c.fillStyle = `hsl(${hash % 360}, 60%, 50%)`;
                c.fillRect(0, 0, 256, 256);
                c.fillStyle = '#fff';
                c.font = '16px sans-serif';
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                c.fillText(key, 128, 128);

                const placeholder = new Image();
                placeholder.src = canvas.toDataURL();
                placeholder.onload = () => {
                    this.images.set(key, placeholder);
                    this.loadedAssets++;
                    resolve();
                };
            };
            img.src = url;
        });
    }

    getImage(key: string): HTMLImageElement | undefined {
        return this.images.get(key);
    }

    hasImage(key: string): boolean {
        return this.images.has(key);
    }

    private async loadSound(key: string, url: string): Promise<void> {
        return new Promise((resolve) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => {
                this.sounds.set(key, audio);
                this.loadedAssets++;
                resolve();
            };
            audio.onerror = () => {
                console.warn(`Failed to load sound: ${key} (${url})`);
                this.loadedAssets++;
                resolve();
            };
            audio.src = url;
            audio.load();
        });
    }

    playSound(key: string, volume: number = 1.0): void {
        const audio = this.sounds.get(key);
        if (audio) {
            audio.volume = volume;
            audio.currentTime = 0;
            audio.play().catch(e => console.warn(`Play failed for ${key}:`, e));
        }
    }
}
