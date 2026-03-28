import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Avatar({ 
  src, 
  alt, 
  size = 'md', 
  isOnline, 
  hasStory,
  className 
}: { 
  src: string; 
  alt: string; 
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'; 
  isOnline?: boolean;
  hasStory?: boolean;
  className?: string;
}) {
  const sizes = {
    xs: 'w-6 h-6',
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
    '2xl': 'w-32 h-32',
  };

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div className={cn(
        'rounded-full overflow-hidden',
        hasStory ? 'border-2 border-primary-accent p-0.5' : '',
        sizes[size]
      )}>
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-full rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
      {isOnline && (
        <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-primary-accent border-2 border-background rounded-full" />
      )}
    </div>
  );
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className, 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: 'bg-primary-accent text-on-primary-accent hover:scale-105 active:scale-95 shadow-lg shadow-primary-accent/10',
    secondary: 'bg-surface-container-highest text-on-surface hover:bg-surface-container-high active:scale-95',
    ghost: 'bg-transparent text-on-surface hover:bg-white/5 active:scale-95',
    danger: 'bg-transparent text-red-400 hover:bg-red-400/10 active:scale-95',
    outline: 'bg-transparent border border-white/20 text-on-surface hover:bg-white/5 active:scale-95',
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs gap-1.5',
    md: 'px-6 py-3 text-sm gap-2',
    lg: 'px-8 py-4 text-base gap-3',
  };

  return (
    <button 
      className={cn(
        'rounded-full font-bold transition-all duration-200 flex items-center justify-center',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className, noPadding, ...props }: { children: React.ReactNode; className?: string; noPadding?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div 
      className={cn(
        'bg-surface-container-low rounded-xl overflow-hidden shadow-xl border border-white/5',
        !noPadding && 'p-5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
