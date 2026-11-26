import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    isWarning?: boolean;
  };
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  highlight = false
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 transition-all duration-200 ${
        highlight
          ? 'bg-gradient-to-b from-blue-950/30 to-[#0E1524] border-blue-500/30 shadow-lg shadow-blue-950/20'
          : 'bg-[#0E1524]/80 hover:bg-[#121B2F]/90 border-slate-800/80 shadow-md shadow-black/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <div
          className={`p-2 rounded-lg ${
            highlight ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800/50 text-slate-400'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-white font-mono">
          {value}
        </span>
        {trend && (
          <span
            className={`text-xs font-medium flex items-center gap-0.5 ${
              trend.isWarning
                ? 'text-rose-400'
                : trend.isPositive
                ? 'text-emerald-400'
                : 'text-slate-400'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-slate-400/90 truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
};
