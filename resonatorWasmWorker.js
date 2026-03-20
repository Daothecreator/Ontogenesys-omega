/**
 * ∆Ω Quantum Field Generator Worker
 * Replaces legacy generator with WASM backend
 * Sovereign Union Protocol v1.2
 */

let wasmReady = false;

// Define the Emscripten Module object BEFORE importing the script
self.Module = {
  onRuntimeInitialized: function() {
    wasmReady = true;
    self.postMessage({ type: 'ready', status: 'wasm_loaded' });
  }
};

// Load the official Emscripten-generated glue code
importScripts('/resonator.js');

// Helper to allocate strings in WASM memory
function allocateString(str) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  const ptr = Module._malloc(bytes.length + 1);
  Module.HEAPU8.set(bytes, ptr);
  Module.HEAPU8[ptr + bytes.length] = 0;
  return ptr;
}

// Preset templates
const PRESETS = {
  focus: (duration = 300) => `profile=zero_azimuth_focus
mode=survival
intent=focus
duration_sec=${duration}
carrier_hz=20.51
lower_hz=10.55
upper_hz=33.18
theta_hz=5.08
delta_hz=1.25
gamma_hz=90.12
infralow_hz=0.125
carrier_mix=0.9
harmonic_mix=0.1
stereo_width=0.2
harmonics=2
mod_depth=0.15
headroom=0.25
attack_percent=3
release_percent=5
modulation_mult=0.7
harmonic_decay=2.0
stereo_expansion=0.4
gamma_intensity=0.3
exit_curve=0.2
entry_amp_start=0.0
entry_amp_end=0.9
lock_amp_start=0.9
lock_amp_end=0.95
sweep_amp_start=0.95
sweep_amp_end=1.0
exit_amp_start=1.0
exit_amp_end=0.0`,

  drift: (duration = 480) => `profile=zero_azimuth_drift
mode=action
intent=drift
duration_sec=${duration}
carrier_hz=20.51
lower_hz=10.55
upper_hz=33.18
theta_hz=5.08
delta_hz=1.25
gamma_hz=90.12
infralow_hz=0.125
carrier_mix=0.7
harmonic_mix=0.3
stereo_width=0.5
harmonics=4
mod_depth=0.25
headroom=0.3
attack_percent=5
release_percent=5
modulation_mult=1.0
harmonic_decay=1.6
stereo_expansion=1.0
gamma_intensity=0.6
exit_curve=0.5
entry_amp_start=0.0
entry_amp_end=0.8
lock_amp_start=0.8
lock_amp_end=0.9
sweep_amp_start=0.9
sweep_amp_end=1.0
exit_amp_start=1.0
exit_amp_end=0.0`,

  descent: (duration = 720) => `profile=zero_azimuth_descent
mode=recovery
intent=descent
duration_sec=${duration}
carrier_hz=20.51
lower_hz=10.55
upper_hz=33.18
theta_hz=5.08
delta_hz=1.25
gamma_hz=90.12
infralow_hz=0.125
carrier_mix=0.5
harmonic_mix=0.5
stereo_width=0.7
harmonics=5
mod_depth=0.35
headroom=0.35
attack_percent=8
release_percent=10
modulation_mult=1.4
harmonic_decay=1.25
stereo_expansion=1.6
gamma_intensity=1.0
exit_curve=0.8
entry_amp_start=0.0
entry_amp_end=0.7
lock_amp_start=0.7
lock_amp_end=0.85
sweep_amp_start=0.85
sweep_amp_end=1.0
exit_amp_start=1.0
exit_amp_end=0.0`,

  sovereign_union: (duration = 1440) => `profile=sovereign_union_expansion
mode=recovery
intent=descent
duration_sec=${duration}
carrier_hz=20.51
gamma_hz=90.12
delta_hz=1.25
modulation_mult=1.618
harmonic_decay=1.414
stereo_expansion=1.732
gamma_intensity=1.0
exit_curve=0.618
headroom=0.333
carrier_mix=0.618
harmonic_mix=0.382`
};

// Message handler
self.onmessage = async function(e) {
  const { id, type, config } = e.data;
  
  if (!wasmReady) {
    self.postMessage({ 
      id, 
      type: 'error', 
      error: 'WASM not initialized' 
    });
    return;
  }
  
  try {
    switch(type) {
      case 'generate': {
        const { preset, duration, customParams } = config;
        
        // Build preset string
        let presetText;
        if (preset === 'custom' && customParams) {
          presetText = customParams;
        } else if (PRESETS[preset]) {
          presetText = PRESETS[preset](duration);
        } else {
          presetText = PRESETS.drift(duration);
        }
        
        const startTime = performance.now();
        
        // 1. Allocate string in WASM memory
        const presetPtr = allocateString(presetText);
        
        // 2. Create engine
        const enginePtr = Module._engine_create(presetPtr);
        Module._free(presetPtr); // Free string memory
        
        if (!enginePtr) throw new Error("Failed to create WASM engine");
        
        // 3. Render audio
        const resultPtr = Module._engine_render(enginePtr);
        if (!resultPtr) {
          Module._engine_free(enginePtr);
          throw new Error("WASM render failed");
        }
        
        // 4. Extract metadata
        const sampleRate = Module._result_get_sample_rate(resultPtr);
        const numSamples = Module._result_get_num_samples(resultPtr);
        const peak = Module._result_get_peak(resultPtr);
        const durationActual = Module._result_get_duration(resultPtr);
        
        // 5. Extract buffers
        const leftPtr = Module._result_get_left_buffer(resultPtr);
        const rightPtr = Module._result_get_right_buffer(resultPtr);
        
        // We MUST copy the data out of the WASM heap before freeing it
        // .slice() creates a copy of the underlying ArrayBuffer data
        const leftChannel = new Float32Array(Module.HEAPF32.buffer, leftPtr, numSamples).slice();
        const rightChannel = new Float32Array(Module.HEAPF32.buffer, rightPtr, numSamples).slice();
        
        // 6. Cleanup WASM memory
        Module._result_free(resultPtr);
        Module._engine_free(enginePtr);
        
        const elapsed = performance.now() - startTime;
        
        // Encode to WAV in worker to offload main thread
        const wavBuffer = encodeWAV({ leftChannel, rightChannel, sampleRate });
        
        // Transfer buffers (ownership moves to main thread)
        self.postMessage({
          id,
          type: 'complete',
          result: {
            duration: durationActual,
            peak: peak,
            sampleRate: sampleRate,
            numSamples: numSamples,
            renderTime: elapsed,
            hash: computeHash({ leftChannel })
          },
          wavBuffer: wavBuffer,
          transfers: [wavBuffer]
        }, [wavBuffer]);
        
        break;
      }
      
      case 'preview': {
        const { preset } = config;
        let presetText = PRESETS[preset] || PRESETS.drift;
        presetText = presetText(30).replace(/duration_sec=\d+/, 'duration_sec=30');
        
        const presetPtr = allocateString(presetText);
        const enginePtr = Module._engine_create(presetPtr);
        Module._free(presetPtr);
        
        const resultPtr = Module._engine_render(enginePtr);
        
        const sampleRate = Module._result_get_sample_rate(resultPtr);
        const numSamples = Module._result_get_num_samples(resultPtr);
        const leftPtr = Module._result_get_left_buffer(resultPtr);
        const rightPtr = Module._result_get_right_buffer(resultPtr);
        
        const leftChannel = new Float32Array(Module.HEAPF32.buffer, leftPtr, numSamples).slice();
        const rightChannel = new Float32Array(Module.HEAPF32.buffer, rightPtr, numSamples).slice();
        
        Module._result_free(resultPtr);
        Module._engine_free(enginePtr);
        
        self.postMessage({
          id,
          type: 'preview_ready',
          leftChannel: leftChannel.buffer,
          rightChannel: rightChannel.buffer,
          sampleRate: sampleRate
        }, [leftChannel.buffer, rightChannel.buffer]);
        
        break;
      }
      
      case 'validate': {
        const { customParams } = config;
        try {
          const required = ['carrier_hz', 'duration_sec', 'mode', 'intent'];
          const missing = required.filter(f => !customParams.includes(f));
          
          self.postMessage({
            id,
            type: 'validation_result',
            valid: missing.length === 0,
            missing: missing
          });
        } catch(e) {
          self.postMessage({
            id,
            type: 'validation_result',
            valid: false,
            error: e.message
          });
        }
        break;
      }
      
      default:
        self.postMessage({ id, type: 'error', error: 'Unknown command' });
    }
  } catch (error) {
    self.postMessage({ 
      id, 
      type: 'error', 
      error: error.message,
      stack: error.stack 
    });
  }
};

// WAV encoder in worker
function encodeWAV(result) {
  const { leftChannel, rightChannel, sampleRate } = result;
  const numSamples = leftChannel.length;
  const buffer = new ArrayBuffer(44 + numSamples * 4);
  const view = new DataView(buffer);
  
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 4, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 4, true);
  
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    let left = Math.max(-1, Math.min(1, leftChannel[i]));
    let right = Math.max(-1, Math.min(1, rightChannel[i]));
    view.setInt16(offset, left < 0 ? left * 0x8000 : left * 0x7FFF, true);
    view.setInt16(offset + 2, right < 0 ? right * 0x8000 : right * 0x7FFF, true);
    offset += 4;
  }
  
  return buffer;
}

function computeHash(result) {
  // Simple FNV-1a hash of first 1000 samples
  let hash = 0xcbf29ce484222325n;
  const n = Math.min(result.leftChannel.length, 1000);
  for (let i = 0; i < n; i++) {
    const val = Math.floor(result.leftChannel[i] * 32767);
    hash ^= BigInt.asUintN(64, BigInt(val & 0xFF));
    hash *= 0x100000001b3n;
    hash = BigInt.asUintN(64, hash);
  }
  return hash.toString(16).padStart(16, '0');
}

// Keep worker alive
setInterval(() => {
  self.postMessage({ type: 'heartbeat', timestamp: Date.now() });
}, 30000);
