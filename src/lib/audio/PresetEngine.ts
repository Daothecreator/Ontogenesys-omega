import type { Preset } from '@/types';

export type HarmonicPoint = {
  freq: number;
  amplitude: number;
};

export const DEFAULT_PRESETS: Omit<Preset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: '∆Ω Fundamental',
    description: 'Core resonance at 20.51 Hz with balanced harmonic field',
    isPublic: true,
    isDefault: true,
    carrierHz: 20.51,
    gammaHz: 90.12,
    deltaHz: 1.25,
    thetaHz: 5.08,
    lowerHz: 10.55,
    upperHz: 33.18,
    infralowHz: 0.125,
    carrierMix: 0.7,
    harmonicMix: 0.3,
    harmonicDecay: 1.6,
    harmonics: 4,
    stereoWidth: 0.5,
    stereoExpansion: 1.0,
    headroom: 0.3,
    modDepth: 0.25,
    gammaIntensity: 0.6,
    modulationMult: 1.0,
    exitCurve: 0.5,
    durationSec: 480,
    attackPercent: 5,
    releasePercent: 5,
    mode: 'drift',
    tags: ['fundamental', 'meditation'],
  },
  {
    name: 'Action Protocol',
    description: 'High-gamma activation for focus and intensity',
    isPublic: true,
    isDefault: false,
    carrierHz: 20.71,
    gammaHz: 90.12,
    deltaHz: 1.25,
    thetaHz: 5.08,
    lowerHz: 10.55,
    upperHz: 33.18,
    infralowHz: 0.125,
    carrierMix: 0.8,
    harmonicMix: 0.4,
    harmonicDecay: 1.4,
    harmonics: 6,
    stereoWidth: 0.7,
    stereoExpansion: 1.2,
    headroom: 0.25,
    modDepth: 0.35,
    gammaIntensity: 0.8,
    modulationMult: 1.5,
    exitCurve: 0.3,
    durationSec: 300,
    attackPercent: 3,
    releasePercent: 8,
    mode: 'action',
    tags: ['focus', 'gamma'],
  },
  {
    name: 'Survival Anchor',
    description: 'Grounding preset with reduced spread and stronger carrier',
    isPublic: true,
    isDefault: false,
    carrierHz: 20.51,
    gammaHz: 90.12,
    deltaHz: 1.25,
    thetaHz: 5.08,
    lowerHz: 10.55,
    upperHz: 33.18,
    infralowHz: 0.125,
    carrierMix: 0.9,
    harmonicMix: 0.2,
    harmonicDecay: 1.8,
    harmonics: 3,
    stereoWidth: 0.3,
    stereoExpansion: 0.8,
    headroom: 0.35,
    modDepth: 0.15,
    gammaIntensity: 0.4,
    modulationMult: 0.5,
    exitCurve: 0.7,
    durationSec: 600,
    attackPercent: 10,
    releasePercent: 15,
    mode: 'survival',
    tags: ['grounding', 'anchor'],
  },
  {
    name: 'Quantum Theta',
    description: 'Theta-biased recovery preset for long-form listening',
    isPublic: true,
    isDefault: false,
    carrierHz: 20.51,
    gammaHz: 90.12,
    deltaHz: 1.25,
    thetaHz: 5.08,
    lowerHz: 5.08,
    upperHz: 20.51,
    infralowHz: 0.125,
    carrierMix: 0.5,
    harmonicMix: 0.5,
    harmonicDecay: 1.5,
    harmonics: 5,
    stereoWidth: 0.8,
    stereoExpansion: 1.5,
    headroom: 0.4,
    modDepth: 0.3,
    gammaIntensity: 0.5,
    modulationMult: 0.8,
    exitCurve: 0.4,
    durationSec: 720,
    attackPercent: 15,
    releasePercent: 20,
    mode: 'recovery',
    tags: ['theta', 'recovery'],
  },
];

export class PresetEngine {
  static calculateHarmonics(baseFreq: number, count: number, decay: number): HarmonicPoint[] {
    const PHI = 1.618033988749895;
    return Array.from({ length: count }, (_, index) => ({
      freq: baseFreq * Math.pow(PHI, index + 1),
      amplitude: Math.pow(1 / decay, index + 1),
    }));
  }

  static validatePreset(preset: Partial<Preset>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (preset.carrierHz !== undefined && (preset.carrierHz < 0.1 || preset.carrierHz > 20000)) {
      errors.push('Carrier frequency must be between 0.1 Hz and 20 kHz');
    }
    if (preset.durationSec !== undefined && (preset.durationSec < 1 || preset.durationSec > 3600)) {
      errors.push('Duration must be between 1 and 3600 seconds');
    }
    if (preset.harmonics !== undefined && (preset.harmonics < 1 || preset.harmonics > 16)) {
      errors.push('Harmonics must be between 1 and 16');
    }
    return { valid: errors.length === 0, errors };
  }

  static generateDescription(preset: Partial<Preset>): string {
    const bits: string[] = [];
    if (preset.mode) bits.push(`${preset.mode} mode`);
    if (preset.carrierHz !== undefined) bits.push(`carrier ${preset.carrierHz.toFixed(2)} Hz`);
    if (preset.durationSec !== undefined) bits.push(`${Math.floor(preset.durationSec / 60)} min`);
    return bits.join(', ');
  }
}
