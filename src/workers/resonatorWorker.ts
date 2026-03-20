import { FlatPreset, Diagnostics, RenderResult } from '../../types';

const PHI = 1.618033988749895;
const PI = 3.14159265358979323846;

interface PhaseParams {
    durationSec: number;
    startFreq: number;
    endFreq: number;
    ampStart: number;
    ampEnd: number;
    modFreq: number;
}

function computeHash(leftBuf: Float32Array, rightBuf: Float32Array): string {
    let hash = 0xcbf29ce484222325n;
    const n = Math.min(leftBuf.length * 2, 1000);
    
    for (let i = 0; i < n; ++i) {
        const isRight = i % 2 !== 0;
        const sampleIndex = Math.floor(i / 2);
        const floatSample = isRight ? rightBuf[sampleIndex] : leftBuf[sampleIndex];
        
        // Convert float to 16-bit int equivalent for hashing
        const sample = Math.max(-32768, Math.min(32767, Math.floor(floatSample * 32767)));
        const u16 = sample < 0 ? 0x10000 + sample : sample;
        
        hash ^= BigInt(u16 & 0xFF);
        hash *= 0x100000001b3n;
        hash ^= BigInt((u16 >> 8) & 0xFF);
        hash *= 0x100000001b3n;
    }
    return hash.toString(16).padStart(16, '0');
}

let wasmInstance: WebAssembly.Instance | null = null;
let wasmMemory: WebAssembly.Memory | null = null;
let wasmExports: any = null;

async function initWasm() {
    try {
        const response = await fetch('/resonator.wasm');
        if (!response.ok) return false;
        const buffer = await response.arrayBuffer();
        
        wasmMemory = new WebAssembly.Memory({ initial: 256, maximum: 16384, shared: false });
        const wasmTable = new WebAssembly.Table({ initial: 128, maximum: 128, element: 'anyfunc' });
        
        const imports = {
            env: {
                memory: wasmMemory,
                __indirect_function_table: wasmTable,
                emscripten_resize_heap: (delta: number) => {
                    const oldPages = wasmMemory!.buffer.byteLength / 65536;
                    const newPages = Math.max(oldPages + delta, 0);
                    if (wasmMemory!.grow(newPages - oldPages) < 0) return -1;
                    return 0;
                },
                emscripten_memcpy_big: (dest: number, src: number, num: number) => {
                    const heap8 = new Uint8Array(wasmMemory!.buffer);
                    heap8.set(heap8.subarray(src, src + num), dest);
                    return dest;
                }
            },
            wasi_snapshot_preview1: {
                fd_close: () => 0,
                fd_seek: () => 0,
                fd_write: () => 0,
                proc_exit: () => 0,
                environ_get: () => 0,
                environ_sizes_get: () => 0,
            }
        };

        const result = await WebAssembly.instantiate(buffer, imports);
        wasmInstance = result.instance;
        wasmExports = wasmInstance.exports;
        return true;
    } catch (e) {
        console.warn("WASM initialization failed, falling back to TS:", e);
        return false;
    }
}

const wasmReadyPromise = initWasm();

function stringToUTF8(str: string, outPtr: number, maxBytesToWrite: number) {
    const heap8 = new Uint8Array(wasmMemory!.buffer);
    let currPtr = outPtr;
    for (let i = 0; i < str.length; ++i) {
        let u = str.charCodeAt(i);
        if (u >= 0x80) u = 0xFFFD;
        if (currPtr - outPtr >= maxBytesToWrite - 1) break;
        heap8[currPtr++] = u;
    }
    heap8[currPtr] = 0;
    return currPtr - outPtr;
}

function presetToIni(p: FlatPreset): string {
    let ini = "";
    for (const [k, v] of Object.entries(p)) {
        ini += `${k}=${v}\n`;
    }
    return ini;
}

self.onmessage = async (e: MessageEvent<{ preset: FlatPreset }>) => {
    const p = e.data.preset;
    
    const isWasmReady = await wasmReadyPromise;
    
    if (isWasmReady && wasmExports) {
        console.log("Rendering using WASM engine...");
        
        const presetText = presetToIni(p);
        const presetLen = presetText.length + 1;
        
        const malloc = wasmExports.wasm_malloc || wasmExports._malloc;
        const free = wasmExports.wasm_free || wasmExports._free;
        
        const presetPtr = malloc(presetLen);
        stringToUTF8(presetText, presetPtr, presetLen);
        
        const enginePtr = wasmExports.engine_create(presetPtr);
        free(presetPtr);
        
        if (!enginePtr) {
            console.error("WASM Engine creation failed");
            return;
        }
        
        self.postMessage({ type: 'progress', progress: 0.5 });
        
        const resultPtr = wasmExports.engine_render(enginePtr);
        if (!resultPtr) {
            wasmExports.engine_free(enginePtr);
            console.error("WASM Render failed");
            return;
        }
        
        const sampleRate = wasmExports.result_get_sample_rate(resultPtr);
        const numSamples = wasmExports.result_get_num_samples(resultPtr);
        const peak = wasmExports.result_get_peak(resultPtr);
        const duration = wasmExports.result_get_duration(resultPtr);
        
        const leftPtr = wasmExports.result_get_left_buffer(resultPtr);
        const rightPtr = wasmExports.result_get_right_buffer(resultPtr);
        
        const leftBuf = new Float32Array(numSamples);
        const rightBuf = new Float32Array(numSamples);
        const heapF32 = new Float32Array(wasmMemory!.buffer);
        
        for (let i = 0; i < numSamples; i++) {
            leftBuf[i] = heapF32[(leftPtr >> 2) + i];
            rightBuf[i] = heapF32[(rightPtr >> 2) + i];
        }
        
        wasmExports.result_free(resultPtr);
        wasmExports.engine_free(enginePtr);
        
        let dcLeft = 0, dcRight = 0;
        for (let i = 0; i < numSamples; i++) {
            dcLeft += leftBuf[i];
            dcRight += rightBuf[i];
        }
        dcLeft /= numSamples;
        dcRight /= numSamples;
        
        let sumSqLeft = 0, sumSqRight = 0;
        for (let i = 0; i < numSamples; i++) {
            const l = leftBuf[i] - dcLeft;
            const r = rightBuf[i] - dcRight;
            sumSqLeft += l * l;
            sumSqRight += r * r;
        }
        const rmsLeft = Math.sqrt(sumSqLeft / numSamples);
        const rmsRight = Math.sqrt(sumSqRight / numSamples);
        const avgRms = (rmsLeft + rmsRight) / 2.0;
        const crestFactor = avgRms > 1e-9 ? peak / avgRms : 0;
        
        const diag: Diagnostics = {
            peakAmplitude: peak,
            rmsLeft,
            rmsRight,
            dcLeft,
            dcRight,
            crestFactor,
            durationActual: duration,
            frameCount: numSamples,
            hash: computeHash(leftBuf, rightBuf)
        };
        
        self.postMessage({ type: 'progress', progress: 1.0 });
        self.postMessage({ type: 'done', result: { audioBuffer: [leftBuf, rightBuf], diagnostics: diag } });
        
        return;
    }
    
    console.log("Rendering using TypeScript engine fallback...");
    
    const sampleRate = p.sample_rate || 48000;
    const totalSec = p.duration_sec || 480;
    const mode = p.mode || "action";
    
    const carrierBias = (mode === "action") ? 0.2 : (mode === "survival") ? 0.0 : 0.1;
    const baseFreq = p.carrier_hz + carrierBias;
    
    const sweepRange = Math.max(0.0, Math.min(1.0, 0.6 + p.stereo_expansion * 0.25));
    const sweepStart = baseFreq - (baseFreq - p.lower_hz) * sweepRange;
    const sweepEnd = baseFreq + (p.upper_hz - baseFreq) * sweepRange;
    const exitTarget = p.infralow_hz * p.exit_curve + p.theta_hz * (1.0 - p.exit_curve);
    
    const phases: PhaseParams[] = [
        {
            durationSec: totalSec * p.entry_ratio,
            startFreq: p.theta_hz,
            endFreq: baseFreq,
            ampStart: p.entry_amp_start,
            ampEnd: p.entry_amp_end,
            modFreq: p.delta_hz
        },
        {
            durationSec: totalSec * p.lock_ratio,
            startFreq: baseFreq,
            endFreq: baseFreq,
            ampStart: p.lock_amp_start,
            ampEnd: p.lock_amp_end,
            modFreq: p.gamma_hz * 0.3 * p.modulation_mult
        },
        {
            durationSec: totalSec * p.sweep_ratio,
            startFreq: sweepStart,
            endFreq: sweepEnd,
            ampStart: p.sweep_amp_start,
            ampEnd: p.sweep_amp_end,
            modFreq: p.gamma_hz * p.modulation_mult
        },
        {
            durationSec: totalSec * p.exit_ratio,
            startFreq: sweepEnd,
            endFreq: exitTarget,
            ampStart: p.exit_amp_start,
            ampEnd: p.exit_amp_end,
            modFreq: p.delta_hz
        }
    ];

    let totalSamples = 0;
    for (const phase of phases) {
        totalSamples += Math.floor(phase.durationSec * sampleRate);
    }

    const leftBuf = new Float32Array(totalSamples);
    const rightBuf = new Float32Array(totalSamples);
    
    let globalTime = 0.0;
    let offset = 0;

    for (const phase of phases) {
        const samples = Math.floor(phase.durationSec * sampleRate);
        const attackSamples = phase.durationSec * sampleRate * p.attack_percent / 100.0;
        const releaseSamples = phase.durationSec * sampleRate * p.release_percent / 100.0;
        
        for (let i = 0; i < samples; ++i) {
            const t = globalTime + i / sampleRate;
            const progress = i / samples;
            
            const freq = phase.startFreq * Math.pow(phase.endFreq / phase.startFreq, progress);
            
            let amp = phase.ampStart + (phase.ampEnd - phase.ampStart) * progress;
            
            if (attackSamples > 0.0 && i < attackSamples) {
                amp *= i / attackSamples;
            }
            if (releaseSamples > 0.0 && i >= samples - releaseSamples) {
                amp *= (samples - i) / releaseSamples;
            }
            
            const modPhase = 2 * PI * phase.modFreq * t;
            const modDepthEffective = p.mod_depth * p.gamma_intensity;
            const am = 1.0 + modDepthEffective * Math.sin(modPhase);
            const fm = Math.sin(2 * PI * p.delta_hz * t) * 0.5;
            
            const effectiveWidth = Math.max(0.0, Math.min(1.0, p.stereo_width * p.stereo_expansion));
            const stereoPhase = effectiveWidth * 0.35;
            
            let leftHarmonics = 0.0;
            let rightHarmonics = 0.0;
            
            for (let h = 1; h <= p.harmonics; ++h) {
                const hf = freq * Math.pow(PHI, h);
                const ha = Math.pow(1.0 / p.harmonic_decay, h);
                const pan = (h % 2 === 0) ? -effectiveWidth : effectiveWidth;
                
                leftHarmonics += ha * (1.0 + pan * 0.3) * Math.sin(2 * PI * hf * (t - stereoPhase) + fm);
                rightHarmonics += ha * (1.0 - pan * 0.3) * Math.sin(2 * PI * hf * (t + stereoPhase) + fm);
            }
            
            const leftCarrier = p.carrier_mix * Math.sin(2 * PI * freq * (t - stereoPhase) + fm);
            const rightCarrier = p.carrier_mix * Math.sin(2 * PI * freq * (t + stereoPhase) + fm);
            
            const baseAmp = p.headroom * amp * am;
            let left = baseAmp * (leftCarrier + p.harmonic_mix * leftHarmonics);
            let right = baseAmp * (rightCarrier + p.harmonic_mix * rightHarmonics);
            
            left = Math.tanh(left);
            right = Math.tanh(right);
            
            leftBuf[offset + i] = left;
            rightBuf[offset + i] = right;
        }
        
        globalTime += phase.durationSec;
        offset += samples;
        
        // Report progress
        self.postMessage({ type: 'progress', progress: offset / totalSamples });
    }

    // Diagnostics
    let dcLeft = 0;
    let dcRight = 0;
    for (let i = 0; i < totalSamples; i++) {
        dcLeft += leftBuf[i];
        dcRight += rightBuf[i];
    }
    dcLeft /= totalSamples;
    dcRight /= totalSamples;

    let sumSqLeft = 0;
    let sumSqRight = 0;
    let peak = 0;

    for (let i = 0; i < totalSamples; i++) {
        const l = leftBuf[i] - dcLeft;
        const r = rightBuf[i] - dcRight;
        sumSqLeft += l * l;
        sumSqRight += r * r;
        peak = Math.max(peak, Math.abs(leftBuf[i]), Math.abs(rightBuf[i]));
    }

    const rmsLeft = Math.sqrt(sumSqLeft / totalSamples);
    const rmsRight = Math.sqrt(sumSqRight / totalSamples);
    const avgRms = (rmsLeft + rmsRight) / 2.0;
    const crestFactor = avgRms > 1e-9 ? peak / avgRms : 0;

    const diag: Diagnostics = {
        peakAmplitude: peak,
        rmsLeft,
        rmsRight,
        dcLeft,
        dcRight,
        crestFactor,
        durationActual: totalSamples / sampleRate,
        frameCount: totalSamples,
        hash: computeHash(leftBuf, rightBuf)
    };

    self.postMessage({ type: 'done', result: { audioBuffer: [leftBuf, rightBuf], diagnostics: diag } });
};
