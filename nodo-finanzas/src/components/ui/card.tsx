import React from 'react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
  title?: string;
}

export function Card({ className = '', children, title }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-mist p-5 ${className}`}>
      {title && (
        <h3 className="text-base font-bold text-ink mb-4">{title}</h3>
      )}
      {children}
    </div>
  );
}
