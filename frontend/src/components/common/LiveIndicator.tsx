import React from 'react';

interface LiveIndicatorProps {
  connected: boolean;
}

export const LiveIndicator: React.FC<LiveIndicatorProps> = ({ connected }) => {
  return (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono">
      <span className="relative flex h-2 w-2">
        {connected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </>
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
        )}
      </span>
      <span className={connected ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
        {connected ? 'LIVE WS' : 'RECONNECTING'}
      </span>
    </div>
  );
};
