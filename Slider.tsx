"use client";

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  label?: string;
  unit?: string;
  formatValue?: (value: number) => string;
}

const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, label, unit, formatValue, ...props }, ref) => {
    const value = props.value?.[0] ?? props.defaultValue?.[0] ?? 0;
    const renderedValue = formatValue ? formatValue(value) : `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`;

    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground">{label}</label>
          <span className="font-mono text-sm text-quantum-cyan">{renderedValue}</span>
        </div>
        <SliderPrimitive.Root ref={ref} className="relative flex w-full touch-none select-none items-center" {...props}>
          <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
            <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-quantum-cyan to-quantum-magenta" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-quantum-cyan bg-quantum-void shadow" />
        </SliderPrimitive.Root>
      </div>
    );
  }
);

Slider.displayName = 'Slider';

export { Slider };
