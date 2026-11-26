import React from 'react';
import { Database } from 'lucide-react';

export const DemoBadge: React.FC = () => {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/40 border border-amber-500/30 text-[11px] font-mono text-amber-300 font-medium tracking-wide">
      <Database className="w-3 h-3 text-amber-400" />
      <span>DEMO DATA ACTIVE</span>
    </div>
  );
};
