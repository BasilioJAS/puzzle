/**
 * Audio sintetizado con WebAudio: el prototipo no necesita archivos de sonido,
 * cada efecto se describe en game.config.json (onda, frecuencia, duración, ganancia).
 */
import { C } from '../config';
import { save } from './save';

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let musicTimer: number | null = null;
let musicStep = 0;

function ac(): AudioContext {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctx;
}

/** iOS/Android necesitan un gesto del usuario para arrancar el audio. */
export function unlockAudio(): void {
    const c = ac();
    if (c.state === 'suspended') void c.resume();
}

export function sfx(name: string): void {
    if (!save.data.settings.sfx) return;
    const def = C().audio.sfx[name];
    if (!def) return;
    const c = ac();
    if (c.state === 'suspended') void c.resume();
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = def.wave;
    osc.frequency.setValueAtTime(def.freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, def.to), t0 + def.dur);
    g.gain.setValueAtTime(def.gain * C().audio.sfxVolume, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + def.dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + def.dur + 0.02);
}

/** Loop de música: arpegio simple con las notas del config. */
export function startMusic(): void {
    stopMusic();
    if (!save.data.settings.music) return;
    const cfg = C().audio;
    const c = ac();
    if (c.state === 'suspended') void c.resume();
    musicGain = c.createGain();
    musicGain.gain.value = cfg.musicVolume;
    musicGain.connect(c.destination);
    const stepMs = (60 / Math.max(1, cfg.music.bpm)) * 1000;
    musicTimer = window.setInterval(() => {
        const note = cfg.music.notes[musicStep++ % cfg.music.notes.length];
        const t0 = c.currentTime;
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = cfg.music.wave;
        osc.frequency.setValueAtTime(note, t0);
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(1, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + stepMs / 1000);
        osc.connect(g).connect(musicGain!);
        osc.start(t0);
        osc.stop(t0 + stepMs / 1000 + 0.05);
    }, stepMs);
}

export function stopMusic(): void {
    if (musicTimer !== null) { clearInterval(musicTimer); musicTimer = null; }
    if (musicGain) { musicGain.disconnect(); musicGain = null; }
}

export function refreshMusic(): void {
    if (save.data.settings.music) startMusic(); else stopMusic();
}
