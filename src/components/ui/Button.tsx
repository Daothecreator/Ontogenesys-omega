import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'quantum' | 'secondary' | 'ghost';
    isLoading?: boolean;
    children?: React.ReactNode;
}

export function Button({ variant = 'secondary', isLoading, children, className = '', disabled, ...props }: ButtonProps) {
    const base = 'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none';
    const variants: Record<string, string> = {
        quantum: 'bg-quantum-cyan/15 text-quantum-cyan border border-quantum-cyan/30 hover:bg-quantum-cyan/25',
        secondary: 'bg-white/10 text-white border border-white/10 hover:bg-white/20',
        ghost: 'bg-transparent text-white/60 hover:bg-white/10',
    };
    return (
        <button className={`${base} ${variants[variant] ?? ''} ${className}`} disabled={disabled || isLoading} {...props}>
            {isLoading ? (
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
            ) : null}
            {children}
        </button>
    );
}
