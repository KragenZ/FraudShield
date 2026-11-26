import React from 'react';
import { TransactionStatus, AlertStatus, AlertSeverity } from '../../types';

interface StatusBadgeProps {
  status: TransactionStatus | AlertStatus | AlertSeverity | string;
  type?: 'transaction' | 'alert' | 'severity';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = status.toUpperCase();

  let styles = 'bg-slate-800/60 text-slate-300 border-slate-700/50';

  // Transaction Statuses
  if (normalized === 'APPROVED') {
    styles = 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30';
  } else if (normalized === 'FLAGGED') {
    styles = 'bg-amber-950/40 text-amber-300 border-amber-500/40';
  } else if (normalized === 'BLOCKED') {
    styles = 'bg-rose-950/50 text-rose-300 border-rose-500/40 font-semibold';
  } else if (normalized === 'UNDER_REVIEW') {
    styles = 'bg-blue-950/40 text-blue-300 border-blue-500/30';
  }

  // Alert Statuses
  else if (normalized === 'NEW') {
    styles = 'bg-rose-950/40 text-rose-400 border-rose-500/40 animate-pulse';
  } else if (normalized === 'IN_REVIEW') {
    styles = 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30';
  } else if (normalized === 'RESOLVED') {
    styles = 'bg-teal-950/40 text-teal-300 border-teal-500/30';
  } else if (normalized === 'CONFIRMED_FRAUD') {
    styles = 'bg-rose-950/50 text-rose-300 border-rose-500/40 font-semibold';
  } else if (normalized === 'FALSE_POSITIVE') {
    styles = 'bg-slate-800/80 text-slate-400 border-slate-600/40';
  }

  // Severities
  else if (normalized === 'CRITICAL') {
    styles = 'bg-rose-950/60 text-rose-200 border-rose-500/60 font-semibold tracking-wide';
  } else if (normalized === 'HIGH') {
    styles = 'bg-rose-950/30 text-rose-400 border-rose-500/30';
  } else if (normalized === 'MEDIUM') {
    styles = 'bg-amber-950/30 text-amber-300 border-amber-500/30';
  } else if (normalized === 'LOW') {
    styles = 'bg-blue-950/30 text-blue-300 border-blue-500/30';
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider border ${styles}`}
    >
      {normalized.replace('_', ' ')}
    </span>
  );
};
