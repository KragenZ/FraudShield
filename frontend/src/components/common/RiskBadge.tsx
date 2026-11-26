import React from 'react';
import { useSettings } from '../../context/SettingsContext';
import { getRiskBand } from '../../utils/riskPolicy';

interface RiskBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  thresholds?: { flag_threshold: number; block_threshold: number };
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  score,
  showLabel = true,
  size = 'md',
  thresholds
}) => {
  const { settings } = useSettings();
  const activeThresholds = thresholds ?? {
    flag_threshold: settings.flag_threshold,
    block_threshold: settings.block_threshold
  };
  const band = getRiskBand(score, activeThresholds);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5'
  }[size];

  return (
    <span
      title={band.label}
      className={`inline-flex items-center gap-1.5 font-mono font-medium rounded-full border transition-colors ${band.badgeClasses} ${sizeClasses}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${band.dotColor} ${band.pulse ? 'animate-pulse' : ''}`}
      />
      <span>{score}</span>
      {showLabel && (
        <span className="opacity-70 text-[10px] uppercase font-sans tracking-wider">
          ({band.level})
        </span>
      )}
    </span>
  );
};
