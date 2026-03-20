import { FlatPreset } from './types';
import { PRESETS, DEFAULT_PRESET } from './presets';

export interface FieldRequest {
    intent: string;        // "focus", "drift", "descent"
    mode: string;          // "action", "survival", "recovery"
    durationMinutes: number;    // 1-60
    outputPath: string;    // полный путь к WAV
    presetPath: string;    // optional: кастомный .ini
}

export interface FieldMetrics {
    peakAmplitude: number;
    rmsLeft: number;
    rmsRight: number;
    dcOffsetLeft: number;
    dcOffsetRight: number;
    crestFactor: number;
    frameCount: number;
    durationActual: number;
    contentHash: string;
    renderTime?: number;
}

export interface FieldResult {
    success: boolean;
    errorMessage: string;
    wavPath: string;
    metrics: FieldMetrics;
    wavBuffer?: ArrayBuffer;
}

function presetToIni(p: any): string {
    let ini = "";
    for (const [k, v] of Object.entries(p)) {
        ini += `${k}=${v}\n`;
    }
    return ini;
}

export class ResonatorModule {
    private worker: Worker | null = null;
    private onProgress?: (progress: number) => void;

    constructor(onProgress?: (progress: number) => void) {
        this.onProgress = onProgress;
    }

    public async render(req: FieldRequest): Promise<FieldResult> {
        return new Promise((resolve) => {
            try {
                if (this.worker) {
                    this.worker.terminate();
                }
                // Use classic worker for importScripts
                this.worker = new Worker(new URL('./workers/resonatorWasmWorker.js', import.meta.url));

                let preset: FlatPreset = { ...DEFAULT_PRESET };
                
                if (req.presetPath && req.presetPath.startsWith('{')) {
                    try {
                        preset = { ...preset, ...JSON.parse(req.presetPath) };
                    } catch (e) {
                        console.warn("Invalid JSON in presetPath, using defaults");
                    }
                } else {
                    const intentKey = req.intent.charAt(0).toUpperCase() + req.intent.slice(1).toLowerCase();
                    if (PRESETS[intentKey]) {
                        preset = { ...PRESETS[intentKey] };
                    }
                }

                preset.intent = req.intent;
                preset.mode = req.mode;
                preset.duration_sec = req.durationMinutes * 60;

                const presetIni = presetToIni(preset);

                this.worker.onmessage = (e) => {
                    if (e.data.type === 'ready') {
                        if (this.onProgress) this.onProgress(0.1); // Indicate start
                        // Worker is ready, send generate command
                        this.worker?.postMessage({
                            id: 'render_1',
                            type: 'generate',
                            config: {
                                preset: 'custom',
                                duration: preset.duration_sec,
                                customParams: presetIni
                            }
                        });
                    } else if (e.data.type === 'complete') {
                        const { result, wavBuffer } = e.data;
                        
                        const metrics: FieldMetrics = {
                            peakAmplitude: result.peak || 0,
                            rmsLeft: 0, // Not provided by WASM worker
                            rmsRight: 0,
                            dcOffsetLeft: 0,
                            dcOffsetRight: 0,
                            crestFactor: 0,
                            frameCount: result.numSamples || 0,
                            durationActual: result.duration || 0,
                            contentHash: result.hash || "",
                            renderTime: result.renderTime
                        };

                        resolve({
                            success: true,
                            errorMessage: "",
                            wavPath: req.outputPath || "generated.wav",
                            metrics,
                            wavBuffer
                        });
                        
                        this.worker?.terminate();
                        this.worker = null;
                    } else if (e.data.type === 'error') {
                        resolve({
                            success: false,
                            errorMessage: e.data.error,
                            wavPath: "",
                            metrics: this.emptyMetrics(),
                        });
                        this.worker?.terminate();
                        this.worker = null;
                    }
                };

                this.worker.onerror = (err) => {
                    resolve({
                        success: false,
                        errorMessage: err.message,
                        wavPath: "",
                        metrics: this.emptyMetrics(),
                    });
                    this.worker?.terminate();
                    this.worker = null;
                };

            } catch (err: any) {
                resolve({
                    success: false,
                    errorMessage: err.message || "Unknown error",
                    wavPath: "",
                    metrics: this.emptyMetrics(),
                });
            }
        });
    }

    public listBuiltins(): string[] {
        return Object.keys(PRESETS).map(k => k.toLowerCase());
    }

    public stop() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

    private emptyMetrics(): FieldMetrics {
        return {
            peakAmplitude: 0,
            rmsLeft: 0,
            rmsRight: 0,
            dcOffsetLeft: 0,
            dcOffsetRight: 0,
            crestFactor: 0,
            frameCount: 0,
            durationActual: 0,
            contentHash: ""
        };
    }
}
