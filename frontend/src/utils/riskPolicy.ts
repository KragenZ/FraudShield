import { SystemSettings } from '../types';

export const DEFAULT_SETTINGS: SystemSettings = {
  flag_threshold: 50,
  block_threshold: 85,
  auto_block_high_risk: false,
  email_alerts: false
};

export interface RiskBand {
  level: 'CRITICAL' | 'MEDIUM' | 'LOW';
  tier: 'HIGH_RISK' | 'UNDER_REVIEW' | 'APPROVED';
  label: string;
  badgeClasses: string;
  dotColor: string;
  barColor: string;
  pulse: boolean;
}

export function getRiskBand(
  score: number,
  thresholds?: { flag_threshold: number; block_threshold: number }
): RiskBand {
  const flagThreshold = thresholds?.flag_threshold ?? DEFAULT_SETTINGS.flag_threshold;
  const blockThreshold = thresholds?.block_threshold ?? DEFAULT_SETTINGS.block_threshold;

  if (score >= blockThreshold) {
    return {
      level: 'CRITICAL',
      tier: 'HIGH_RISK',
      label: 'High Risk (Urgent Review)',
      badgeClasses: 'bg-rose-950/50 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-900/20',
      dotColor: 'bg-rose-500',
      barColor: 'bg-rose-500',
      pulse: true
    };
  }

  if (score >= flagThreshold) {
    return {
      level: 'MEDIUM',
      tier: 'UNDER_REVIEW',
      label: 'Medium Risk (Human Review)',
      badgeClasses: 'bg-amber-950/30 text-amber-400 border-amber-500/30',
      dotColor: 'bg-amber-400',
      barColor: 'bg-amber-500',
      pulse: false
    };
  }

  return {
    level: 'LOW',
    tier: 'APPROVED',
    label: 'Low Risk (Approved)',
    badgeClasses: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30',
    dotColor: 'bg-emerald-500',
    barColor: 'bg-emerald-500',
    pulse: false
  };
}
