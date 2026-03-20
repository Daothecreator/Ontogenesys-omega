import React from 'react';

interface SliderProps {
    label: string;
    min: number;
    max: number;
    step: number;
    value: number[];
    onValueChange: (value: number[]) => void;
    unit?: string;
    formatValue?: (v: number) => string;
}

export function Slider({ label, min, max, step, value, onValueChange, unit, formatValue }: SliderProps) {
    const current = value[0] ?? min;
    const display = formatValue
        ? formatValue(current)
        : unit
        ? `${current}${unit}`
        : String(current);

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="text-white/60">{label}</span>
                <span className="font-mono text-quantum-cyan">{display}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={current}
                onChange={(e) => onValueChange([parseFloat(e.target.value)])}
                className="w-full accent-quantum-cyan cursor-pointer"
            />
        </div>
    );
}
