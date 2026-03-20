import { FlatPreset } from './types';

export const DEFAULT_PRESET: FlatPreset = {
    profile: "zero_azimuth",
    mode: "action",
    intent: "drift",
    duration_sec: 480,
    sample_rate: 48000,

    carrier_hz: 20.51,
    lower_hz: 10.55,
    upper_hz: 33.18,
    theta_hz: 5.08,
    delta_hz: 1.25,
    gamma_hz: 90.12,
    infralow_hz: 0.125,

    entry_ratio: 0.15,
    lock_ratio: 0.25,
    sweep_ratio: 0.45,
    exit_ratio: 0.15,

    entry_amp_start: 0.0,
    entry_amp_end: 0.8,
    lock_amp_start: 0.8,
    lock_amp_end: 0.9,
    sweep_amp_start: 0.9,
    sweep_amp_end: 1.0,
    exit_amp_start: 1.0,
    exit_amp_end: 0.0,

    carrier_mix: 0.7,
    harmonic_mix: 0.3,
    stereo_width: 0.5,
    harmonics: 4,
    mod_depth: 0.25,
    headroom: 0.3,
    attack_percent: 5,
    release_percent: 5,

    modulation_mult: 1.0,
    harmonic_decay: 1.6,
    stereo_expansion: 1.0,
    gamma_intensity: 0.6,
    exit_curve: 0.5
};

export const PRESET_FOCUS: FlatPreset = {
    ...DEFAULT_PRESET,
    profile: "zero_azimuth_focus",
    mode: "survival",
    intent: "focus",
    duration_sec: 300,
    modulation_mult: 0.7,
    harmonic_decay: 2.0,
    stereo_expansion: 0.4,
    gamma_intensity: 0.3,
    exit_curve: 0.2
};

export const PRESET_DRIFT: FlatPreset = {
    ...DEFAULT_PRESET,
    profile: "zero_azimuth_drift",
    mode: "action",
    intent: "drift",
    duration_sec: 480,
    modulation_mult: 1.0,
    harmonic_decay: 1.6,
    stereo_expansion: 1.0,
    gamma_intensity: 0.6,
    exit_curve: 0.5
};

export const PRESET_DESCENT: FlatPreset = {
    ...DEFAULT_PRESET,
    profile: "zero_azimuth_descent",
    mode: "recovery",
    intent: "descent",
    duration_sec: 720,
    modulation_mult: 1.4,
    harmonic_decay: 1.25,
    stereo_expansion: 1.6,
    gamma_intensity: 1.0,
    exit_curve: 0.8
};

export const PRESETS: Record<string, FlatPreset> = {
    "Focus": PRESET_FOCUS,
    "Drift": PRESET_DRIFT,
    "Descent": PRESET_DESCENT
};
