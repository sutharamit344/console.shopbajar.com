import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  variant?: 'default' | 'dark' | 'muted' | 'glass';
  padding?: boolean;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = true,
  variant = 'default',
  padding = true,
  ...props
}) => {
  const baseStyles = 'rounded-md border transition-all duration-300 overflow-hidden';

  const variants = {
    default: 'bg-white dark:bg-zinc-900 border-black/[0.06] dark:border-zinc-800/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-zinc-900 dark:text-zinc-100',
    dark: 'bg-[#0A0A0F] dark:bg-zinc-955 border-white/[0.08] dark:border-zinc-800 text-white',
    muted: 'bg-black/[0.02] dark:bg-zinc-900/50 border-black/[0.05] dark:border-zinc-800 text-zinc-900 dark:text-zinc-100',
    glass: 'bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border-white/30 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100',
  };

  const hoverStyles = hover ? 'hover:border-black/[0.12] dark:hover:border-zinc-700 hover:shadow-[0_4px_20px_rgba(0,0,0,0.04)]' : '';
  const paddingStyle = padding ? 'p-4 md:p-6' : '';

  return (
    <div
      className={`${baseStyles} ${variants[variant] || variants.default} ${hoverStyles} ${paddingStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
