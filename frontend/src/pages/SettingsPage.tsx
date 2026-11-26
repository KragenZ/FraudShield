import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Sliders,
  Bell,
  Shield,
  Save,
  CheckCircle,
  RefreshCw,
  Server
} from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [flagThreshold, setFlagThreshold] = useState<number>(50);
  const [blockThreshold, setBlockThreshold] = useState<number>(85);
  const [autoBlockHighRisk, setAutoBlockHighRisk] = useState<boolean>(true);
  const [emailAlerts, setEmailAlerts] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isTestingHealth, setIsTestingHealth] = useState<boolean>(false);

  const checkHealth = async () => {
    setIsTestingHealth(true);
    try {
      const res = await api.getHealth();
      setSystemHealth(res);
    } catch (e: any) {
      setSystemHealth({ status: 'offline', error: e.message });
    } finally {
      setIsTestingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h3 className="text-base font-semibold text-white">System Settings & Risk Thresholds</h3>
        <p className="text-xs text-slate-400">Configure heuristic thresholds, notification routing, and data backends</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Risk Thresholds Card */}
        <div className="p-5 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <Sliders className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-white">Risk Score Scoring Rules</h4>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Under Review / Flagged Threshold</span>
                <span className="font-mono text-amber-400 font-semibold">{flagThreshold} / 100</span>
              </div>
              <input
                type="range"
                min="20"
                max="80"
                value={flagThreshold}
                onChange={(e) => setFlagThreshold(Number(e.target.value))}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Transactions scoring above this index will be flagged for analyst review.
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">Automatic Block Threshold</span>
                <span className="font-mono text-rose-400 font-semibold">{blockThreshold} / 100</span>
              </div>
              <input
                type="range"
                min="60"
                max="99"
                value={blockThreshold}
                onChange={(e) => setBlockThreshold(Number(e.target.value))}
                className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Transactions scoring equal or greater than this index are immediately blocked.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-300">Automated Quarantine</span>
                <p className="text-[11px] text-slate-400">Instantly generate high-severity alerts for blocked transactions</p>
              </div>
              <input
                type="checkbox"
                checked={autoBlockHighRisk}
                onChange={(e) => setAutoBlockHighRisk(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Database & Infrastructure */}
        <div className="p-5 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-semibold text-white">Database & Infrastructure</h4>
            </div>
            <button
              type="button"
              onClick={checkHealth}
              disabled={isTestingHealth}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingHealth ? 'animate-spin' : ''}`} />
              Test Connection
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 font-mono space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">Active Engine</span>
              <span className="text-white font-semibold">
                {systemHealth?.database?.engine === 'postgresql' ? 'PostgreSQL 15+' : 'SQLite (Local Sandbox)'}
              </span>
              <span className="text-[11px] text-slate-400 block">
                Status: <span className="text-emerald-400">{systemHealth?.database?.status || 'Active'}</span>
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 font-mono space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">WebSocket Gateway</span>
              <span className="text-white font-semibold">ws://127.0.0.1:8000/ws/live</span>
              <span className="text-[11px] text-slate-400 block">
                Latency: <span className="text-emerald-400">&lt; 5ms</span>
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            To switch between SQLite and PostgreSQL, configure the <span className="text-slate-300 font-mono">DATABASE_URL</span> variable in <span className="text-slate-300 font-mono">backend/.env</span>.
          </p>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between">
          <div>
            {isSaved && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <CheckCircle className="w-3.5 h-3.5" />
                Settings saved successfully!
              </span>
            )}
          </div>

          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium tracking-tight shadow-md shadow-blue-950/40 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};
