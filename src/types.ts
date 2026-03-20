export interface FlatPreset {
    profile: string;
    mode: string;
    intent: string;
    duration_sec: number;
    sample_rate: number;

    carrier_hz: number;
    lower_hz: number;
    upper_hz: number;
    theta_hz: number;
    delta_hz: number;
    gamma_hz: number;
    infralow_hz: number;

    entry_ratio: number;
    lock_ratio: number;
    sweep_ratio: number;
    exit_ratio: number;

    entry_amp_start: number;
    entry_amp_end: number;
    lock_amp_start: number;
    lock_amp_end: number;
    sweep_amp_start: number;
    sweep_amp_end: number;
    exit_amp_start: number;
    exit_amp_end: number;

    carrier_mix: number;
    harmonic_mix: number;
    stereo_width: number;
    harmonics: number;
    mod_depth: number;
    headroom: number;
    attack_percent: number;
    release_percent: number;

    modulation_mult: number;
    harmonic_decay: number;
    stereo_expansion: number;
    gamma_intensity: number;
    exit_curve: number;
}

export interface Diagnostics {
    peakAmplitude: number;
    rmsLeft: number;
    rmsRight: number;
    dcLeft: number;
    dcRight: number;
    crestFactor: number;
    durationActual: number;
    frameCount: number;
    hash: string;
}

export interface RenderResult {
    audioBuffer: Float32Array[];
    diagnostics: Diagnostics;
}

export interface Preset {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    isDefault: boolean;
    carrierHz: number;
    gammaHz: number;
    deltaHz: number;
    thetaHz: number;
    lowerHz: number;
    upperHz: number;
    infralowHz: number;
    carrierMix: number;
    harmonicMix: number;
    harmonicDecay: number;
    harmonics: number;
    stereoWidth: number;
    stereoExpansion: number;
    headroom: number;
    modDepth: number;
    gammaIntensity: number;
    modulationMult: number;
    exitCurve: number;
    durationSec: number;
    attackPercent: number;
    releasePercent: number;
    mode: string;
    tags: string[];
    createdAt?: Date;
    updatedAt?: Date;
}
