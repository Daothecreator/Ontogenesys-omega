import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'quantum';
type ButtonSize = 'default' | 'sm' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-white text-black hover:bg-white/90',
  destructive: 'bg-red-500 text-white hover:bg-red-600',
  outline: 'border border-white/20 bg-transparent text-white hover:bg-white/10',
  secondary: 'bg-white/10 text-white hover:bg-white/20',
  ghost: 'text-white hover:bg-white/10',
  quantum: 'border border-quantum-cyan/40 bg-quantum-cyan/10 text-quantum-cyan hover:bg-quantum-cyan/20',
};

const sizeClasses: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', isLoading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        disabled={props.disabled || isLoading}
        {...props}
      >
        {isLoading ? 'Processing…' : children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export { Button };
