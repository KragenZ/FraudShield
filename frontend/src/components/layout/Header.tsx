import React from 'react';
import { LiveIndicator } from '../common/LiveIndicator';
import { DemoBadge } from '../common/DemoBadge';
import { PlusCircle, RefreshCw } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  wsConnected: boolean;
  onSimulateClick: () => void;
  onRefreshClick: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  wsConnected,
  onSimulateClick,
  onRefreshClick,
  isRefreshing = false
}) => {
  return (
    <header className="h-16 px-8 border-b border-slate-800/80 bg-[#0A0E1A]/60 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      <div>
        <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <DemoBadge />
        <LiveIndicator connected={wsConnected} />

        <div className="h-4 w-[1px] bg-slate-800 mx-1" />

        <button
          onClick={onRefreshClick}
          disabled={isRefreshing}
          title="Refresh Current View"
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
        </button>

        <button
          onClick={onSimulateClick}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium tracking-tight shadow-md shadow-blue-950/40 border border-blue-400/30 transition-all hover:scale-[1.02]"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Inject Test Tx</span>
        </button>
      </div>
    </header>
  );
};
