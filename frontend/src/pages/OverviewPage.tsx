import React from 'react';
import {
  CreditCard,
  ShieldAlert,
  Percent,
  DollarSign,
  TrendingUp,
  Activity,
  ArrowUpRight,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { AnalyticsSummary, Transaction, FraudAlert } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { StatusBadge } from '../components/common/StatusBadge';

interface OverviewPageProps {
  analytics: AnalyticsSummary | null;
  recentTransactions: Transaction[];
  recentAlerts: FraudAlert[];
  isLoading: boolean;
  onSelectTransaction: (tx: Transaction) => void;
  onSelectAlert: (alert: FraudAlert) => void;
  onNavigateToTransactions: () => void;
  onNavigateToAlerts: () => void;
}

const PIE_COLORS = ['#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export const OverviewPage: React.FC<OverviewPageProps> = ({
  analytics,
  recentTransactions,
  recentAlerts,
  isLoading,
  onSelectTransaction,
  onSelectAlert,
  onNavigateToTransactions,
  onNavigateToAlerts
}) => {
  if (isLoading || !analytics) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <Activity className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Loading Risk Telemetry...</p>
        </div>
      </div>
    );
  }

  const { stats, trends, type_distribution } = analytics;
  const approvedCount = stats.approved_count ?? 0;
  const underReviewCount = stats.under_review_count ?? 0;
  const flaggedCount = stats.flagged_count ?? 0;
  const blockedCount = stats.blocked_count ?? 0;

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Transactions"
          value={stats.total_transactions.toLocaleString()}
          subtitle={`Approved: ${approvedCount.toLocaleString()} • Review: ${underReviewCount.toLocaleString()}`}
          icon={CreditCard}
          trend={{ value: `${stats.approved_rate ?? 0}% approved`, isPositive: true }}
        />
        <MetricCard
          title="Fraud Detected"
          value={stats.fraud_detected.toLocaleString()}
          subtitle={`Flagged: ${flaggedCount.toLocaleString()} • Blocked: ${blockedCount.toLocaleString()} (${stats.high_risk_alerts} alerts)`}
          icon={ShieldAlert}
          trend={{ value: 'Action Required', isWarning: stats.fraud_detected > 0 }}
          highlight={stats.fraud_detected > 0}
        />
        <MetricCard
          title="Fraud Detection Rate"
          value={`${stats.fraud_detection_rate}%`}
          subtitle={`Avg risk index: ${stats.average_risk_score}/100`}
          icon={Percent}
          trend={{ value: 'Target < 2.5%', isPositive: stats.fraud_detection_rate < 2.5 }}
        />
        <MetricCard
          title="Total Volume"
          value={`$${stats.total_volume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          subtitle="USD total processed"
          icon={DollarSign}
          trend={{ value: `${underReviewCount} under review`, isWarning: underReviewCount > 0 }}
        />
      </div>

      {/* Charts Row: Fraud Trends + Transaction Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#0E1524]/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Fraud Trends Over Time
              </h3>
              <p className="text-xs text-slate-400">Total volume vs flagged transaction volume</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                Total Volume
              </span>
              <span className="flex items-center gap-1.5 text-rose-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                Fraud Volume
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalVolGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="fraudVolGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time_label"
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#1E293B' }}
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
                  formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, '']}
                />
                <Area
                  type="monotone"
                  dataKey="total_volume"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#totalVolGrad)"
                  name="Total Vol"
                />
                <Area
                  type="monotone"
                  dataKey="fraud_volume"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#fraudVolGrad)"
                  name="Fraud Vol"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Doughnut Chart (1 col) */}
        <div className="p-5 rounded-xl bg-[#0E1524]/80 border border-slate-800/80 shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Channel Breakdown
            </h3>
            <p className="text-xs text-slate-400 mb-2">Volume distribution by payment type</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={type_distribution}
                  dataKey="volume"
                  nameKey="type_name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {type_distribution.map((entry, index) => (
                    <Cell key={`cell-${entry.type_name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#F8FAFC'
                  }}
                  formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, 'Volume']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 mt-2">
            {type_distribution.slice(0, 4).map((item, idx) => (
              <div key={item.type_name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300 truncate max-w-[150px]">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  {item.type_name.replace('_', ' ')}
                </span>
                <span className="font-mono text-slate-400">
                  ${(item.volume / 1000).toFixed(1)}k
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Two Column Bottom Grid: Recent Activity + Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions Feed */}
        <div className="p-5 rounded-xl bg-[#0E1524]/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                Recent Transaction Stream
              </h3>
              <p className="text-xs text-slate-400">Real-time incoming payment events</p>
            </div>
            <button
              onClick={onNavigateToTransactions}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
            >
              View all <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {recentTransactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction(tx)}
                className="p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/60 flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-slate-800 text-slate-400 group-hover:text-white transition-colors">
                    <CreditCard className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium text-white">{tx.id}</span>
                      <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                        {tx.customer_name || tx.customer_id}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {tx.transaction_type.replace('_', ' ')} • {new Date(tx.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs font-mono font-semibold text-white">
                      ${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>
                  <RiskBadge score={tx.risk_score} showLabel={false} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent High-Priority Fraud Alerts */}
        <div className="p-5 rounded-xl bg-[#0E1524]/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Recent Fraud Alerts
              </h3>
              <p className="text-xs text-slate-400">Suspicious triggers requiring SecOps review</p>
            </div>
            <button
              onClick={onNavigateToAlerts}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
            >
              Triage alerts <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {recentAlerts.slice(0, 5).map((alert) => (
              <div
                key={alert.id}
                onClick={() => onSelectAlert(alert)}
                className="p-3 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800/60 flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-white">
                        {alert.id}
                      </span>
                      <StatusBadge status={alert.severity} />
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-[240px] font-mono mt-0.5">
                      {alert.reason}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <StatusBadge status={alert.status} />
                  <RiskBadge score={alert.risk_score} size="sm" showLabel={false} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
