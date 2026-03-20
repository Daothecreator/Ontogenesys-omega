import { Preset } from '../../types';
import { clamp } from '../utils';

export interface RenderResult {
  leftChannel: Float32Array;
  rightChannel: Float32Array;
  sampleRate: number;
  duration: number;
  peakAmplitude: number;
}

class ResonatorEngine {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.audioContext = new window.AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
    this.isInitialized = true;
  }

  async render(preset: Partial<Preset>): Promise<RenderResult> {
    const sampleRate = 48000;
    const duration = clamp(preset.durationSec ?? 480, 1, 3600);
    const length = Math.floor(sampleRate * duration);
    const left = new Float32Array(length);
    const right = new Float32Array(length);

    const carrierHz = preset.carrierHz ?? 20.51;
    const gammaHz = preset.gammaHz ?? 90.12;
    const thetaHz = preset.thetaHz ?? 5.08;
    const deltaHz = preset.deltaHz ?? 1.25;
    const stereoWidth = preset.stereoWidth ?? 0.5;
    const stereoExpansion = preset.stereoExpansion ?? 1;
    const carrierMix = preset.carrierMix ?? 0.7;
    const harmonicMix = preset.harmonicMix ?? 0.3;
    const harmonicDecay = preset.harmonicDecay ?? 1.6;
    const harmonics = preset.harmonics ?? 4;
    const modDepth = preset.modDepth ?? 0.25;
    const gammaIntensity = preset.gammaIntensity ?? 0.6;
    const attackPercent = (preset.attackPercent ?? 5) / 100;
    const releasePercent = (preset.releasePercent ?? 5) / 100;
    const headroom = 1 - (preset.headroom ?? 0.3);

    const attackSamples = Math.max(1, Math.floor(length * attackPercent));
    const releaseSamples = Math.max(1, Math.floor(length * releasePercent));

    let peak = 0;
    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const phaseOffset = stereoWidth * 0.15;
      const lfo = 1 + Math.sin(2 * Math.PI * deltaHz * t) * modDepth;
      const thetaMod = Math.sin(2 * Math.PI * thetaHz * t) * 0.15;
      const gammaGate = (Math.sin(2 * Math.PI * gammaHz * t) * 0.5 + 0.5) * gammaIntensity;

      let baseL = Math.sin(2 * Math.PI * carrierHz * (t + phaseOffset)) * carrierMix * lfo;
      let baseR = Math.sin(2 * Math.PI * carrierHz * (t - phaseOffset)) * carrierMix * lfo;

      for (let h = 1; h <= harmonics; h += 1) {
        const harmonicFreq = carrierHz * (h + 1) * stereoExpansion;
        const amp = (harmonicMix / harmonics) * Math.pow(1 / harmonicDecay, h - 1);
        baseL += Math.sin(2 * Math.PI * harmonicFreq * t + thetaMod) * amp;
        baseR += Math.sin(2 * Math.PI * harmonicFreq * t - thetaMod) * amp;
      }

      let env = 1;
      if (i < attackSamples) env = i / attackSamples;
      else if (i > length - releaseSamples) env = (length - i) / releaseSamples;

      const sampleL = clamp(baseL * env * (0.6 + gammaGate * 0.4) * headroom, -1, 1);
      const sampleR = clamp(baseR * env * (0.6 + gammaGate * 0.4) * headroom, -1, 1);
      left[i] = sampleL;
      right[i] = sampleR;
      peak = Math.max(peak, Math.abs(sampleL), Math.abs(sampleR));
    }

    return { leftChannel: left, rightChannel: right, sampleRate, duration, peakAmplitude: peak };
  }

  async play(result: RenderResult): Promise<void> {
    if (!this.audioContext) await this.initialize();
    if (!this.audioContext) throw new Error('Audio context unavailable');

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.stop();

    const buffer = this.audioContext.createBuffer(2, result.leftChannel.length, result.sampleRate);
    buffer.copyToChannel(result.leftChannel, 0);
    buffer.copyToChannel(result.rightChannel, 1);

    const source = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    gain.gain.value = 0.5;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.audioContext.destination);
    source.start(0);

    this.sourceNode = source;
    this.gainNode = gain;

    await new Promise<void>((resolve) => {
      source.onended = () => {
        if (this.sourceNode === source) {
          this.sourceNode = null;
        }
        resolve();
      };
    });
  }

  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {}
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  exportWAV(result: RenderResult): Blob {
    const { leftChannel, rightChannel, sampleRate } = result;
    const numSamples = leftChannel.length;
    const numChannels = 2;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeString = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i += 1) {
      view.setInt16(offset, Math.max(-32768, Math.min(32767, leftChannel[i] * 32767)), true);
      offset += 2;
      view.setInt16(offset, Math.max(-32768, Math.min(32767, rightChannel[i] * 32767)), true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  dispose(): void {
    this.stop();
    void this.audioContext?.close();
    this.audioContext = null;
    this.isInitialized = false;
  }
}

export const resonatorEngine = new ResonatorEngine();
