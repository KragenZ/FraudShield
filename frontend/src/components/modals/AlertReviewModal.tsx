import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { FraudAlert } from '../../types';
import { RiskBadge } from '../common/RiskBadge';
import { StatusBadge } from '../common/StatusBadge';

interface AlertReviewModalProps {
  alert: FraudAlert | null;
  onClose: () => void;
  onSave: (
    alertId: string,
    data: { status: string; reviewed_by: string; resolution_notes: string }
  ) => Promise<void>;
}

export const AlertReviewModal: React.FC<AlertReviewModalProps> = ({
  alert,
  onClose,
  onSave
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>(
    alert?.status === 'NEW' ? 'RESOLVED' : alert?.status || 'RESOLVED'
  );
  const [reviewerName, setReviewerName] = useState<string>(
    alert?.reviewed_by || 'Security Analyst'
  );
  const [resolutionNotes, setResolutionNotes] = useState<string>(
    alert?.resolution_notes || ''
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!alert) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(alert.id, {
        status: selectedStatus,
        reviewed_by: reviewerName,
        resolution_notes: resolutionNotes
      });
      onClose();
    } catch (err) {
      console.error('Failed to update alert:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0E1524] border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0B0F19]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white font-mono">
                  {alert.id}
                </h3>
                <StatusBadge status={alert.severity} />
              </div>
              <p className="text-xs text-slate-400">Incident Triage & Investigation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close alert review modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Incident Details Card */}
          <div className="p-4 rounded-lg bg-[#0B0F19] border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Triggered Transaction ID:</span>
              <span className="text-xs font-mono font-medium text-blue-400">
                {alert.transaction_id}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Calculated Risk Score:</span>
              <RiskBadge score={alert.risk_score} size="sm" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Detection Timestamp:</span>
              <span className="text-xs font-mono text-slate-300">
                {new Date(alert.created_at).toLocaleString()}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-800/60">
              <span className="text-xs font-medium text-slate-300">Rule Trigger Reason:</span>
              <p className="mt-1 text-xs text-slate-300/90 bg-slate-900/80 p-2.5 rounded border border-slate-800/80 leading-relaxed font-mono">
                {alert.reason}
              </p>
            </div>
          </div>

          {/* Action Decision */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-2">
              Resolution Disposition
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedStatus('CONFIRMED_FRAUD')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  selectedStatus === 'CONFIRMED_FRAUD'
                    ? 'bg-rose-950/40 border-rose-500/50 text-rose-300 shadow-sm shadow-rose-950/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <ShieldAlert className="w-4 h-4 mb-1 text-rose-400" />
                <span className="text-xs font-medium">Confirmed Fraud</span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Flag transaction (no auto-block)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('FALSE_POSITIVE')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  selectedStatus === 'FALSE_POSITIVE'
                    ? 'bg-slate-800/90 border-slate-600/60 text-slate-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <XCircle className="w-4 h-4 mb-1 text-slate-400" />
                <span className="text-xs font-medium">False Positive</span>
                <span className="text-[10px] text-slate-400 mt-0.5">
                  Restore transaction to Approved
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('RESOLVED')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  selectedStatus === 'RESOLVED'
                    ? 'bg-teal-950/40 border-teal-500/50 text-teal-300 shadow-sm shadow-teal-950/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 mb-1 text-teal-400" />
                <span className="text-xs font-medium">Mark Resolved</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Close incident</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus('IN_REVIEW')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all ${
                  selectedStatus === 'IN_REVIEW'
                    ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-300 shadow-sm shadow-indigo-950/30'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <Clock className="w-4 h-4 mb-1 text-indigo-400" />
                <span className="text-xs font-medium">In Review</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Escalate deeper</span>
              </button>
            </div>
          </div>

          {/* Reviewer Name */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
              Reviewing Officer / Analyst
            </label>
            <input
              type="text"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 font-mono"
              placeholder="e.g. Elena R. (Tier 2 SecOps)"
            />
          </div>

          {/* Resolution Notes */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300 mb-1.5">
              Resolution Investigation Notes
            </label>
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-[#0B0F19] border border-slate-800 text-white text-xs focus:outline-none focus:border-blue-500 font-mono resize-none"
              placeholder="e.g. Contacted cardholder via verified push notification; confirmed authorized purchase."
            />
          </div>

          {/* Buttons */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-all shadow-md shadow-blue-950/40 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
