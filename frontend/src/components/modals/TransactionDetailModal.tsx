import React from 'react';
import { X, Shield, Globe, User, Activity } from 'lucide-react';
import { Transaction } from '../../types';
import { RiskBadge } from '../common/RiskBadge';
import { StatusBadge } from '../common/StatusBadge';
import { useSettings } from '../../context/SettingsContext';
import { getRiskBand } from '../../utils/riskPolicy';

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose
}) => {
  const { settings } = useSettings();

  if (!transaction) return null;

  const band = getRiskBand(transaction.risk_score, settings);

  let evaluationSummary: string;
  if (band.tier === 'HIGH_RISK') {
    evaluationSummary = `High risk pattern (score >= ${settings.block_threshold}): Urgent review required due to anomalous transfer value combined with cross-border routing or velocity flags.`;
  } else if (band.tier === 'UNDER_REVIEW') {
    evaluationSummary = `Medium risk pattern (score ${settings.flag_threshold}-${settings.block_threshold - 1}): Queued for human review due to elevated risk indicators.`;
  } else {
    evaluationSummary = `Low risk profile (score < ${settings.flag_threshold}): Normal activity matching expected customer velocity and recognized payment credentials.`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0E1524] border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0B0F19]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white font-mono">
                  {transaction.id}
                </h3>
                <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  DEMO RECORD
                </span>
              </div>
              <p className="text-xs text-slate-400">Transaction Audit & Telemetry</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close transaction details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Top Status & Amount Row */}
          <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-[#0B0F19] border border-slate-800/80">
            <div>
              <span className="text-xs text-slate-400">Amount</span>
              <div className="text-2xl font-semibold font-mono text-white mt-1">
                ${transaction.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className="text-xs text-slate-400 font-sans ml-1.5">{transaction.currency}</span>
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-400">Transaction Status</span>
              <div className="mt-1.5">
                <StatusBadge status={transaction.status} />
              </div>
            </div>

            <div>
              <span className="text-xs text-slate-400">Risk Assessment</span>
              <div className="mt-1.5">
                <RiskBadge score={transaction.risk_score} size="md" />
              </div>
            </div>
          </div>

          {/* Core Information Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <User className="w-3.5 h-3.5 text-blue-400" />
                Customer Profile
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Name:</span>
                  <span className="text-slate-200 font-medium">{transaction.customer_name || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer ID:</span>
                  <span className="text-slate-300 font-mono">{transaction.customer_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Channel / Type:</span>
                  <span className="text-slate-200">{transaction.transaction_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Counterparty / Merchant:</span>
                  <span className="text-slate-200">{transaction.merchant || 'Internal Gateway'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800/60 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                Network & Device Context
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">IP Address:</span>
                  <span className="text-slate-300 font-mono">{transaction.ip_address || '127.0.0.1'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Geographic Origin:</span>
                  <span className="text-slate-200">{transaction.location || 'Direct / Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Device Fingerprint:</span>
                  <span className="text-slate-200">{transaction.device_type || 'Generic Browser'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recorded At:</span>
                  <span className="text-slate-300 font-mono">
                    {new Date(transaction.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Scoring Breakdown */}
          <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-rose-400" />
                Machine Risk Evaluation
              </span>
              <span className="text-xs font-mono text-slate-400">
                Probability: {(transaction.fraud_probability * 100).toFixed(1)}%
              </span>
            </div>

            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${band.barColor}`}
                style={{ width: `${Math.min(100, Math.max(0, transaction.risk_score))}%` }}
              />
            </div>

            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              {evaluationSummary}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#0B0F19] border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
