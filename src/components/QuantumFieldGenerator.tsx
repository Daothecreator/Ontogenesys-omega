import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import { Activity, Brain, Download, Pause, Play, RotateCcw, Save, Shield, Wind, Zap } from 'lucide-react';
import type { Preset } from '@/types';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { resonatorEngine, type RenderResult } from '@/lib/audio/ResonatorEngine';
import { DEFAULT_PRESETS, PresetEngine } from '@/lib/audio/PresetEngine';
import { formatDuration, formatFrequency } from '@/lib/utils';

type ModeType = 'action' | 'survival' | 'recovery' | 'drift';

type SavedPreset = Omit<Preset, 'id' | 'userId' | 'createdAt' | 'updatedAt'> & {
  id: string;
  savedAt: string;
};

const MODE_CONFIG: Record<ModeType, { icon: ComponentType<{ className?: string }>; color: string; desc: string }> = {
  action: { icon: Zap, color: 'text-yellow-400', desc: 'High-gamma activation' },
  survival: { icon: Shield, color: 'text-red-400', desc: 'Emergency grounding' },
  recovery: { icon: Brain, color: 'text-green-400', desc: 'Deep restoration' },
  drift: { icon: Wind, color: 'text-blue-400', desc: 'Free exploration' },
};

const DEFAULT_PARAMS: Partial<Preset> = {
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
  stereoExpansion: 1,
  headroom: 0.3,
  modDepth: 0.25,
  gammaIntensity: 0.6,
  modulationMult: 1,
  exitCurve: 0.5,
  durationSec: 180,
  attackPercent: 5,
  releasePercent: 5,
  mode: 'drift',
  tags: [],
};

const PARAM_SECTIONS = {
  frequencies: [
    { key: 'carrierHz', label: 'Carrier', min: 0.1, max: 200, step: 0.01, unit: 'Hz' },
    { key: 'gammaHz', label: 'Gamma', min: 20, max: 200, step: 0.01, unit: 'Hz' },
    { key: 'deltaHz', label: 'Delta', min: 0.1, max: 4, step: 0.01, unit: 'Hz' },
    { key: 'thetaHz', label: 'Theta', min: 4, max: 8, step: 0.01, unit: 'Hz' },
    { key: 'lowerHz', label: 'Lower', min: 0.1, max: 100, step: 0.01, unit: 'Hz' },
    { key: 'upperHz', label: 'Upper', min: 1, max: 200, step: 0.01, unit: 'Hz' },
  ],
  audio: [
    { key: 'carrierMix', label: 'Carrier mix', min: 0, max: 1, step: 0.01 },
    { key: 'harmonicMix', label: 'Harmonic mix', min: 0, max: 1, step: 0.01 },
    { key: 'harmonicDecay', label: 'Harmonic decay', min: 1.01, max: 10, step: 0.01 },
    { key: 'stereoWidth', label: 'Stereo width', min: 0, max: 1, step: 0.01 },
    { key: 'stereoExpansion', label: 'Stereo expansion', min: 0, max: 2, step: 0.01 },
    { key: 'gammaIntensity', label: 'Gamma intensity', min: 0, max: 1, step: 0.01 },
  ],
  timing: [
    { key: 'durationSec', label: 'Duration', min: 10, max: 600, step: 1, formatter: formatDuration },
    { key: 'attackPercent', label: 'Attack', min: 0, max: 50, step: 1, unit: '%' },
    { key: 'releasePercent', label: 'Release', min: 0, max: 50, step: 1, unit: '%' },
    { key: 'modDepth', label: 'Mod depth', min: 0, max: 1, step: 0.01 },
    { key: 'modulationMult', label: 'Mod multiplier', min: 0, max: 5, step: 0.01 },
    { key: 'exitCurve', label: 'Exit curve', min: 0, max: 1, step: 0.01 },
  ],
} as const;

const STORAGE_KEY = 'resonator-presets';

function loadSavedPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedPreset[]) : [];
  } catch {
    return [];
  }
}

function persistPresets(presets: SavedPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {}
}

export function QuantumFieldGenerator() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof typeof PARAM_SECTIONS>('frequencies');
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState('New Preset');
  const [params, setParams] = useState<Partial<Preset>>(DEFAULT_PARAMS);
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([]);
  const [visualizerData, setVisualizerData] = useState<Float32Array | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const init = async () => {
      try {
        await resonatorEngine.initialize();
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize engine');
      }
    };
    void init();
    setSavedPresets(loadSavedPresets());

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      resonatorEngine.dispose();
    };
  }, []);

  const updateParam = useCallback(<K extends keyof Preset>(key: K, value: Preset[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    setRenderResult(null);
  }, []);

  const applyPreset = useCallback((preset: Partial<Preset>) => {
    setParams((prev) => ({ ...prev, ...preset }));
    if (preset.name) setPresetName(preset.name);
    setRenderResult(null);
    setError(null);
  }, []);

  const validation = useMemo(() => PresetEngine.validatePreset(params), [params]);
  const currentMode = (params.mode as ModeType) || 'drift';
  const ModeIcon = MODE_CONFIG[currentMode].icon;

  const handleRender = async (): Promise<RenderResult | null> => {
    if (!isInitialized) return null;
    setIsRendering(true);
    setError(null);
    try {
      const result = await resonatorEngine.render(params);
      setRenderResult(result);
      setVisualizerData(result.leftChannel.slice(0, 1024));
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed');
      return null;
    } finally {
      setIsRendering(false);
    }
  };

  const handlePlay = async () => {
    try {
      if (isPlaying) {
        resonatorEngine.stop();
        setIsPlaying(false);
        return;
      }
      let result = renderResult;
      if (!result) result = await handleRender();
      if (!result) return;
      setIsPlaying(true);
      await resonatorEngine.play(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playback failed');
    } finally {
      setIsPlaying(false);
    }
  };

  const handleExport = () => {
    if (!renderResult) return;
    const blob = resonatorEngine.exportWAV(renderResult);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${presetName.replace(/\s+/g, '-').toLowerCase()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSavePreset = () => {
    const saved: SavedPreset = {
      ...params,
      id: `${Date.now()}`,
      name: presetName,
      description: PresetEngine.generateDescription(params),
      isPublic: false,
      isDefault: false,
      tags: params.tags ?? [],
      savedAt: new Date().toISOString(),
    } as SavedPreset;
    const updated = [...savedPresets.filter((p) => p.name !== presetName), saved];
    setSavedPresets(updated);
    persistPresets(updated);
  };

  const handleDeletePreset = (id: string) => {
    const updated = savedPresets.filter((p) => p.id !== id);
    setSavedPresets(updated);
    persistPresets(updated);
  };

  useEffect(() => {
    if (!canvasRef.current || !visualizerData) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(5,5,5,0.65)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const sliceWidth = canvas.width / visualizerData.length;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00f0ff';
      ctx.beginPath();
      let x = 0;
      for (let i = 0; i < visualizerData.length; i += 1) {
        const y = (visualizerData[i] * 0.5 + 0.5) * canvas.height;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [visualizerData]);

  return (
    <div className="min-h-screen bg-quantum-void p-4 text-white md:p-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12">
            <motion.div className="absolute inset-0 rounded-full border-2 border-quantum-cyan" animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} />
            <motion.div className="absolute inset-2 rounded-full border border-quantum-magenta" animate={{ rotate: -360 }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gradient">∆Ω-RESONATOR</h1>
            <p className="text-sm text-gray-400">Quantum field generator</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <ModeIcon className={MODE_CONFIG[currentMode].color} />
          <span>{MODE_CONFIG[currentMode].desc}</span>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="space-y-6">
          <div className="glass-panel p-5">
            <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <input value={presetName} onChange={(e) => setPresetName(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-lg font-semibold outline-none focus:border-quantum-cyan/50 md:min-w-[280px]" />
                <p className="mt-2 text-sm text-gray-400">{PresetEngine.generateDescription(params)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="quantum" onClick={handleRender} isLoading={isRendering}><Activity className="mr-2 h-4 w-4" />Render</Button>
                <Button variant="secondary" onClick={handlePlay}>{isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{isPlaying ? 'Stop' : 'Play'}</Button>
                <Button variant="secondary" onClick={handleExport} disabled={!renderResult}><Download className="mr-2 h-4 w-4" />WAV</Button>
                <Button variant="secondary" onClick={handleSavePreset}><Save className="mr-2 h-4 w-4" />Save</Button>
                <Button variant="ghost" onClick={() => applyPreset(DEFAULT_PARAMS)}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button>
              </div>
            </div>

            {error ? <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
            {!validation.valid ? <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-300">{validation.errors.join(' • ')}</div> : null}

            <div className="mb-4 grid gap-2 sm:grid-cols-4">
              {(Object.keys(MODE_CONFIG) as ModeType[]).map((mode) => {
                const Icon = MODE_CONFIG[mode].icon;
                return (
                  <button key={mode} type="button" onClick={() => updateParam('mode', mode)} className={`rounded-xl border px-4 py-3 text-left transition ${params.mode === mode ? 'border-quantum-cyan bg-quantum-cyan/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                    <div className="mb-2 flex items-center gap-2"><Icon className={MODE_CONFIG[mode].color} /><span className="font-medium capitalize">{mode}</span></div>
                    <p className="text-xs text-gray-400">{MODE_CONFIG[mode].desc}</p>
                  </button>
                );
              })}
            </div>

            <div className="mb-4 flex gap-2">
              {(Object.keys(PARAM_SECTIONS) as (keyof typeof PARAM_SECTIONS)[]).map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-lg px-4 py-2 text-sm ${activeTab === tab ? 'bg-quantum-cyan/15 text-quantum-cyan' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {PARAM_SECTIONS[activeTab].map((item) => {
                const value = Number(params[item.key as keyof Preset] ?? 0);
                return (
                  <Slider
                    key={item.key}
                    label={item.label}
                    min={item.min}
                    max={item.max}
                    step={item.step}
                    value={[value]}
                    onValueChange={(next) => updateParam(item.key as keyof Preset, next[0] as never)}
                    unit={item.unit}
                    formatValue={item.formatter ?? (item.unit === 'Hz' ? formatFrequency : undefined)}
                  />
                );
              })}
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Signal preview</h2>
              <span className="text-xs text-gray-400">{renderResult ? `${renderResult.sampleRate} Hz • peak ${renderResult.peakAmplitude.toFixed(3)}` : 'No render yet'}</span>
            </div>
            <canvas ref={canvasRef} width={1200} height={280} className="h-[220px] w-full rounded-xl border border-white/10 bg-black/30" />
          </div>
        </section>

        <aside className="space-y-6">
          <div className="glass-panel p-4">
            <h3 className="mb-4 text-sm font-medium text-gray-400">Quick presets</h3>
            <div className="space-y-2">
              {DEFAULT_PRESETS.map((preset) => (
                <button key={preset.name} type="button" onClick={() => applyPreset(preset)} className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
                  <div className="font-medium">{preset.name}</div>
                  <div className="text-xs text-gray-400">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel p-4">
            <h3 className="mb-4 text-sm font-medium text-gray-400">Saved presets</h3>
            <div className="max-h-[320px] space-y-2 overflow-auto">
              {savedPresets.length === 0 ? (
                <div className="text-sm text-gray-400">No saved presets yet.</div>
              ) : (
                savedPresets.map((preset) => (
                  <div key={preset.id} className="flex items-center gap-2">
                    <button type="button" onClick={() => applyPreset(preset)} className="flex-1 rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10">
                      <div className="font-medium">{preset.name}</div>
                      <div className="text-xs text-gray-400">{Number(preset.carrierHz).toFixed(2)} Hz • {preset.mode}</div>
                    </button>
                    <button type="button" onClick={() => handleDeletePreset(preset.id)} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-gray-400 hover:bg-red-500/20 hover:text-red-300">✕</button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-panel p-4">
            <h3 className="mb-4 text-sm font-medium text-gray-400">Active frequencies</h3>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Carrier</span><span className="text-quantum-cyan">{formatFrequency(params.carrierHz ?? 20.51)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Gamma</span><span className="text-quantum-magenta">{formatFrequency(params.gammaHz ?? 90.12)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Sweep</span><span className="text-quantum-gold">{formatFrequency(params.lowerHz ?? 10.55)} - {formatFrequency(params.upperHz ?? 33.18)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Duration</span><span>{formatDuration(params.durationSec ?? 180)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Harmonics</span><span>{params.harmonics ?? 4}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
