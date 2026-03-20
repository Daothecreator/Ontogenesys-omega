import * as React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps {
  label?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  min?: number;
  max?: number;
  step?: number;
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
  className?: string;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, unit, formatValue, min = 0, max = 100, step = 1, value, defaultValue, onValueChange }, ref) => {
    const currentValue = value?.[0] ?? defaultValue?.[0] ?? 0;
    const renderedValue = formatValue
      ? formatValue(currentValue)
      : `${currentValue.toFixed(2)}${unit ? ` ${unit}` : ''}`;
    const percent = ((currentValue - min) / (max - min)) * 100;

    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-400">{label}</label>
          <span className="font-mono text-sm text-quantum-cyan">{renderedValue}</span>
        </div>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
          className="slider-track w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #00f0ff ${percent}%, rgba(255,255,255,0.1) ${percent}%)`,
          }}
        />
      </div>
    );
  },
);

Slider.displayName = 'Slider';

export { Slider };
