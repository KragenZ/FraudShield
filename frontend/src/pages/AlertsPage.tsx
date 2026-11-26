import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronRight,
  Filter,
  Eye
} from 'lucide-react';
import { FraudAlert, AlertListResponse } from '../types';
import { api } from '../services/api';
import { RiskBadge } from '../components/common/RiskBadge';
import { StatusBadge } from '../components/common/StatusBadge';

interface AlertsPageProps {
  onSelectAlert: (alert: FraudAlert) => void;
  refreshTrigger: number;
}

export const AlertsPage: React.FC<AlertsPageProps> = ({
  onSelectAlert,
  refreshTrigger
}) => {
  const [data, setData] = useState<AlertListResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const fetchAlerts = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAlerts({
        status: statusFilter,
        severity: severityFilter,
        limit: 100
      });
      setData(res);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter, refreshTrigger]);

  const filteredAlerts = data?.alerts.filter((alert) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      alert.id.toLowerCase().includes(q) ||
      alert.transaction_id.toLowerCase().includes(q) ||
      alert.reason.toLowerCase().includes(q) ||
      (alert.reviewed_by && alert.reviewed_by.toLowerCase().includes(q))
    );
  }) || [];

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Metrics */}
      <div className="p-4 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Fraud Incident Queue</h3>
            <p className="text-xs text-slate-400">
              {data?.unresolved_count ?? 0} active incidents awaiting security verification
            </p>
          </div>
        </div>

        {/* Status quick tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#0B0F19] border border-slate-800">
          {['ALL', 'NEW', 'IN_REVIEW', 'RESOLVED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded text-xs font-mono uppercase transition-all ${
                statusFilter === st
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#0E1524]/70 border border-slate-800/60">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts by Alert ID, Tx ID, trigger reason..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-[#0B0F19] border border-slate-800 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase text-slate-400">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#0B0F19] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts Grid / List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 font-mono flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
            Loading fraud incidents...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-[#0E1524]/60 border border-slate-800/80">
            <ShieldCheck className="w-10 h-10 text-emerald-400/80 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">No Matching Alerts</h4>
            <p className="text-xs text-slate-400 mt-1">
              All flagged security incidents for this view have been resolved.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => onSelectAlert(alert)}
              className="p-4 rounded-xl bg-[#0E1524]/90 hover:bg-[#121B2F] border border-slate-800/80 hover:border-slate-700/80 transition-all cursor-pointer shadow-md group"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Left Section */}
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      alert.severity === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : alert.severity === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-bold text-white group-hover:text-blue-400 transition-colors">
                        {alert.id}
                      </span>
                      <StatusBadge status={alert.severity} />
                      <StatusBadge status={alert.status} />
                      <span className="text-xs font-mono text-slate-400">
                        Linked Tx: <span className="text-slate-300 font-medium">{alert.transaction_id}</span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-1.5 font-mono leading-relaxed max-w-2xl">
                      {alert.reason}
                    </p>

                    {alert.resolution_notes && (
                      <p className="text-[11px] text-teal-400/90 bg-teal-950/20 border border-teal-500/20 px-2 py-1 rounded mt-2 font-mono">
                        Resolution Note ({alert.reviewed_by}): {alert.resolution_notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center justify-between md:justify-end gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800/60">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">Risk Score</span>
                    <RiskBadge score={alert.risk_score} size="md" />
                  </div>

                  <button className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 text-xs font-medium transition-all flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Review</span>
                  </button>
                </div>
              </div>

              {/* Timestamp footer */}
              <div className="mt-3 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Created: {new Date(alert.created_at).toLocaleString()}</span>
                {alert.reviewed_by && <span>Reviewed By: {alert.reviewed_by}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
