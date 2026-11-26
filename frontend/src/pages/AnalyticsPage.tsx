import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
  DollarSign,
  ShieldAlert,
  Percent,
  CheckCircle,
  Activity
} from 'lucide-react';
import { AnalyticsSummary } from '../types';
import { MetricCard } from '../components/common/MetricCard';

interface AnalyticsPageProps {
  analytics: AnalyticsSummary | null;
  isLoading: boolean;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ analytics, isLoading }) => {
  if (isLoading || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-2">
          <Activity className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Loading Analytics Intelligence...</p>
        </div>
      </div>
    );
  }

  const { stats, trends, type_distribution } = analytics;

  // Legit vs Fraud counts
  const legitimateCount = stats.total_transactions - stats.fraud_detected;
  const legitimateVolume = stats.total_volume - (trends.reduce((acc, t) => acc + t.fraud_volume, 0));

  return (
    <div className="space-y-6">
      {/* Analytics KPI Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Legitimate Transactions"
          value={legitimateCount.toLocaleString()}
          subtitle={`${((legitimateCount / (stats.total_transactions || 1)) * 100).toFixed(1)}% of all traffic`}
          icon={CheckCircle}
          trend={{ value: "Healthy", isPositive: true }}
        />
        <MetricCard
          title="Flagged / Blocked"
          value={stats.fraud_detected.toLocaleString()}
          subtitle="Confirmed risk triggers"
          icon={ShieldAlert}
          trend={{ value: `${stats.fraud_detection_rate}% rate`, isWarning: stats.fraud_detected > 0 }}
          highlight={stats.fraud_detected > 0}
        />
        <MetricCard
          title="Resolved Alerts"
          value={stats.resolved_alerts.toLocaleString()}
          subtitle="Cleared by SecOps team"
          icon={Percent}
          trend={{ value: "Operational", isPositive: true }}
        />
        <MetricCard
          title="Mean Risk Index"
          value={`${stats.average_risk_score} / 100`}
          subtitle="Aggregate portfolio risk"
          icon={Activity}
          trend={{ value: "Normal range", isPositive: true }}
        />
      </div>

      {/* Chart 1: Fraud vs Legitimate Transaction Volume Over Time */}
      <div className="p-5 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              Volume Comparison: Legitimate vs Fraudulent ($ USD)
            </h3>
            <p className="text-xs text-slate-400">Daily financial throughput timeline</p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
              <XAxis dataKey="time_label" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F8FAFC'
                }}
                formatter={(val: any) => [`$${Number(val).toLocaleString()}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Area
                type="monotone"
                dataKey="total_volume"
                name="Total Volume"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="fraud_volume"
                name="Fraudulent Volume"
                stroke="#F43F5E"
                fill="#F43F5E"
                fillOpacity={0.5}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid of 2 Charts: Transaction Count by Day & Channel Vulnerability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Counts Chart */}
        <div className="p-5 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Transaction Velocity & Incident Count
            </h3>
            <p className="text-xs text-slate-400">Total processed vs confirmed fraud hits</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                <XAxis dataKey="time_label" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F8FAFC'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="total_count" name="Total Count" fill="#1E293B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fraud_count" name="Fraud Count" fill="#F43F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Channel Breakdown Table & Metrics */}
        <div className="p-5 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-400" />
              Channel Attack Surface Analysis
            </h3>
            <p className="text-xs text-slate-400">Risk concentration across transaction modalities</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  <th className="pb-2">Channel</th>
                  <th className="pb-2">Volume</th>
                  <th className="pb-2 text-center">Tx Count</th>
                  <th className="pb-2 text-center">Fraud Count</th>
                  <th className="pb-2 text-right">Risk %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {type_distribution.map((item) => {
                  const fraudPct = item.count > 0 ? ((item.fraud_count / item.count) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={item.type_name} className="hover:bg-slate-800/30">
                      <td className="py-2.5 font-medium text-slate-200">
                        {item.type_name.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 text-slate-300">
                        ${item.volume.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                      </td>
                      <td className="py-2.5 text-center text-slate-300">{item.count}</td>
                      <td className="py-2.5 text-center text-rose-400 font-semibold">{item.fraud_count}</td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            Number(fraudPct) > 10
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {fraudPct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
