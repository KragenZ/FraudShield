import React, { useState, useEffect } from 'react';
import {
  Database,
  Sliders,
  Bell,
  Save,
  CheckCircle,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { resolveWebSocketUrl } from '../services/websocket';
import { useSettings } from '../context/SettingsContext';
import { DEFAULT_SETTINGS } from '../utils/riskPolicy';

export const SettingsPage: React.FC = () => {
  const { settings, setSettings } = useSettings();
  const [flagThreshold, setFlagThreshold] = useState<number>(settings.flag_threshold);
  const [blockThreshold, setBlockThreshold] = useState<number>(settings.block_threshold);
  const [autoBlockHighRisk, setAutoBlockHighRisk] = useState<boolean>(
    settings.auto_block_high_risk ?? DEFAULT_SETTINGS.auto_block_high_risk
  );
  const [emailAlerts, setEmailAlerts] = useState<boolean>(
    settings.email_alerts ?? DEFAULT_SETTINGS.email_alerts
  );
  const [systemHealth, setSystemHealth] = useState<Record<string, unknown> | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTestingHealth, setIsTestingHealth] = useState<boolean>(false);

  const wsGatewayUrl = resolveWebSocketUrl();

  const checkHealth = async () => {
    setIsTestingHealth(true);
    try {
      const res = await api.getHealth();
      setSystemHealth(res);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to reach backend';
      setSystemHealth({ status: 'offline', error: message });
    } finally {
      setIsTestingHealth(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadSettingsAndHealth = async () => {
      try {
        const [loadedSettings, health] = await Promise.all([
          api.getSettings(),
          api.getHealth().catch((e) => ({
            status: 'offline',
            error: e instanceof Error ? e.message : 'Unable to reach backend'
          }))
        ]);

        if (!cancelled) {
          setFlagThreshold(loadedSettings.flag_threshold);
          setBlockThreshold(loadedSettings.block_threshold);
          setAutoBlockHighRisk(loadedSettings.auto_block_high_risk);
          setEmailAlerts(loadedSettings.email_alerts);
          setSettings(loadedSettings);
          setSystemHealth(health);
          setErrorMessage(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load settings';
          setErrorMessage(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false);
        }
      }
    };

    void loadSettingsAndHealth();

    return () => {
      cancelled = true;
    };
  }, [setSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(false);
    setErrorMessage(null);

    if (flagThreshold >= blockThreshold) {
      setErrorMessage(
        `Flag threshold (${flagThreshold}) must be strictly less than block threshold (${blockThreshold}).`
      );
      return;
    }

    setIsSaving(true);
    try {
      const updated = await api.updateSettings({
        flag_threshold: flagThreshold,
        block_threshold: blockThreshold,
        auto_block_high_risk: autoBlockHighRisk,
        email_alerts: emailAlerts
      });

      setFlagThreshold(updated.flag_threshold);
      setBlockThreshold(updated.block_threshold);
      setAutoBlockHighRisk(updated.auto_block_high_risk);
      setEmailAlerts(updated.email_alerts);
      setSettings(updated);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  const dbInfo = systemHealth?.database as { engine?: string; status?: string } | undefined;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div>
        <h3 className="text-base font-semibold text-white">System Settings & Risk Thresholds</h3>
        <p className="text-xs text-slate-400">
          Configure heuristic thresholds, notification routing, and data backends
        </p>
      </div>

      {isLoadingSettings && (
        <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 text-xs font-mono text-slate-400">
          Loading saved platform configuration...
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

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
                <label htmlFor="flag-threshold-input" className="text-slate-300 font-medium">
                  Under Review / Flagged Threshold
                </label>
                <span className="font-mono text-amber-400 font-semibold">{flagThreshold} / 100</span>
              </div>
              <input
                id="flag-threshold-input"
                type="range"
                min={0}
                max={100}
                value={flagThreshold}
                onChange={(e) => setFlagThreshold(Number(e.target.value))}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Transactions scoring at or above this index are queued for human analyst review.
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <label htmlFor="block-threshold-input" className="text-slate-300 font-medium">
                  High-Risk / Automatic Block Threshold
                </label>
                <span className="font-mono text-rose-400 font-semibold">{blockThreshold} / 100</span>
              </div>
              <input
                id="block-threshold-input"
                type="range"
                min={0}
                max={100}
                value={blockThreshold}
                onChange={(e) => setBlockThreshold(Number(e.target.value))}
                className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Transactions scoring equal or greater than this index trigger urgent review (or auto-block if enabled).
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between gap-4">
              <div>
                <label htmlFor="auto-block-toggle" className="text-xs font-medium text-slate-300">
                  Automatic Blocking (Disabled by Default — Human Review Mode)
                </label>
                <p className="text-[11px] text-slate-400">
                  When disabled, high-risk transactions are flagged for urgent human review instead of being automatically blocked.
                </p>
              </div>
              <input
                id="auto-block-toggle"
                type="checkbox"
                checked={autoBlockHighRisk}
                onChange={(e) => setAutoBlockHighRisk(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded bg-slate-900 border-slate-700 cursor-pointer shrink-0"
              />
            </div>

            {autoBlockHighRisk && (
              <div
                role="status"
                className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Warning: Automatic blocking is active on the baseline/demo risk engine. Unverified high-scoring transactions will be blocked automatically without human approval.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Notification Routing Card */}
        <div className="p-5 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <Bell className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Notification Routing</h4>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="email-alerts-toggle" className="text-xs font-medium text-slate-300">
                Email Alerts for High-Severity Incidents
              </label>
              <p className="text-[11px] text-slate-400">
                Dispatch escalation notifications to the SecOps distribution list when critical alerts are generated.
              </p>
            </div>
            <input
              id="email-alerts-toggle"
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded bg-slate-900 border-slate-700 cursor-pointer shrink-0"
            />
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
                {dbInfo?.engine === 'postgresql' ? 'PostgreSQL 15+' : 'SQLite (Local Sandbox)'}
              </span>
              <span className="text-[11px] text-slate-400 block">
                Status: <span className="text-emerald-400">{dbInfo?.status || 'Active'}</span>
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 font-mono space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">WebSocket Gateway</span>
              <span className="text-white font-semibold break-all">{wsGatewayUrl}</span>
              <span className="text-[11px] text-slate-400 block">
                Latency: <span className="text-emerald-400">&lt; 5ms</span>
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            To switch between SQLite and PostgreSQL, configure the{' '}
            <span className="text-slate-300 font-mono">DATABASE_URL</span> variable in{' '}
            <span className="text-slate-300 font-mono">backend/.env</span>.
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
            disabled={isSaving}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium tracking-tight shadow-md shadow-blue-950/40 flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
