import React from 'react';

interface RiskBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ score, showLabel = true, size = 'md' }) => {
  let level = 'LOW';
  let badgeClasses = 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30';
  let dotColor = 'bg-emerald-500';

  if (score >= 80) {
    level = 'CRITICAL';
    badgeClasses = 'bg-rose-950/50 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-900/20';
    dotColor = 'bg-rose-500';
  } else if (score >= 60) {
    level = 'HIGH';
    badgeClasses = 'bg-rose-950/30 text-rose-400 border-rose-500/30';
    dotColor = 'bg-rose-400';
  } else if (score >= 35) {
    level = 'MEDIUM';
    badgeClasses = 'bg-amber-950/30 text-amber-400 border-amber-500/30';
    dotColor = 'bg-amber-400';
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded-full border transition-colors ${badgeClasses} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${score >= 80 ? 'animate-pulse' : ''}`} />
      <span>{score}</span>
      {showLabel && <span className="opacity-70 text-[10px] uppercase font-sans tracking-wider">({level})</span>}
    </span>
  );
};
