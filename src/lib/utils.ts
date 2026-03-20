export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

export function formatFrequency(hz: number): string {
    if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
    return `${hz.toFixed(2)} Hz`;
}

export function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
