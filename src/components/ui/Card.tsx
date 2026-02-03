import { ReactNode } from 'react';

interface CardProps {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  hover?: boolean;
}

export function Card({ className = '', children, onClick, hover = false }: CardProps) {
  return (
    <div
      className={`
        bg-slate-800/50 border border-slate-700 rounded-xl
        ${hover ? 'hover:border-slate-600 hover:bg-slate-800/70 cursor-pointer transition-all duration-200' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`px-5 py-4 border-b border-slate-700 ${className}`}>
      {children}
    </div>
  );
}

export function CardContent({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

export function CardFooter({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`px-5 py-4 border-t border-slate-700 ${className}`}>
      {children}
    </div>
  );
}
