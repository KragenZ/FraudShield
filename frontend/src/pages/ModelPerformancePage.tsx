import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Target,
  Sparkles,
  Layers,
  HelpCircle,
  FileCheck,
  AlertCircle,
  Activity,
  Zap,
  Info
} from 'lucide-react';
import { ModelPerformanceMetrics } from '../types';
import { api } from '../services/api';

export const ModelPerformancePage: React.FC = () => {
  const [metrics, setMetrics] = useState<ModelPerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await api.getModelMetrics();
        setMetrics(res);
      } catch (err) {
        console.error('Failed to load model metrics:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-2">
          <Activity className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-xs font-mono text-slate-400">Loading Model Evaluation Suite...</p>
        </div>
      </div>
    );
  }

  const { confusion_matrix } = metrics;
  const totalPredictions =
    confusion_matrix.true_positive +
    confusion_matrix.false_positive +
    confusion_matrix.true_negative +
    confusion_matrix.false_negative;

  const accuracy = totalPredictions > 0
    ? (
        ((confusion_matrix.true_positive + confusion_matrix.true_negative) / totalPredictions) *
        100
      ).toFixed(2)
    : '0';

  return (
    <div className="space-y-6">
      {/* Phase 1 Production Notice Banner */}
      <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/30 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 mt-0.5">
          <Info className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white">
              Phase 1 Evaluation Harness: Pre-Training Benchmark Baseline
            </h4>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
              AUDIT READY
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            In compliance with development rules, these figures represent the offline evaluation target baseline.
            Full model training with <span className="text-blue-400 font-mono">XGBoost</span>,{' '}
            <span className="text-blue-400 font-mono">Scikit-learn</span>, and{' '}
            <span className="text-blue-400 font-mono">SHAP</span> feature explainability will be activated in Phase 2.
          </p>
        </div>
      </div>

      {/* Model Spec Ribbon */}
      <div className="p-4 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{metrics.model_name}</span>
              <span className="text-xs font-mono text-slate-400">({metrics.model_version})</span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Evaluated on holdout validation slice ({new Date(metrics.evaluated_at).toLocaleDateString()})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30">
            Accuracy: {accuracy}%
          </span>
          <span className="text-xs font-mono text-blue-400 px-2.5 py-1 rounded-full bg-blue-950/40 border border-blue-500/30">
            ROC-AUC: {(metrics.roc_auc * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 4 Core Classification Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Precision */}
        <div className="p-5 rounded-xl bg-[#0E1524]/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">Precision</span>
            <Target className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3 text-3xl font-bold font-mono text-white">
            {(metrics.precision * 100).toFixed(1)}%
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Fraction of flagged alerts that were actual fraud. Low false positives.
          </p>
        </div>

        {/* Recall */}
        <div className="p-5 rounded-xl bg-[#0E1524]/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">Recall (Sensitivity)</span>
            <Zap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 text-3xl font-bold font-mono text-white">
            {(metrics.recall * 100).toFixed(1)}%
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Fraction of all actual fraudulent attacks successfully intercepted.
          </p>
        </div>

        {/* F1-Score */}
        <div className="p-5 rounded-xl bg-[#0E1524]/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">F1-Score</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 text-3xl font-bold font-mono text-white">
            {metrics.f1_score.toFixed(3)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Harmonic mean balancing precision vs recall on imbalanced fraud datasets.
          </p>
        </div>

        {/* PR-AUC */}
        <div className="p-5 rounded-xl bg-[#0E1524]/80 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">PR-AUC</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 text-3xl font-bold font-mono text-white">
            {metrics.pr_auc.toFixed(3)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Precision-Recall Area Under Curve. Gold standard for 1:1000 fraud ratios.
          </p>
        </div>
      </div>

      {/* Confusion Matrix Section */}
      <div className="p-6 rounded-xl bg-[#0E1524]/90 border border-slate-800/80 shadow-md">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              Confusion Matrix
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated on {totalPredictions.toLocaleString()} classified transactions
            </p>
          </div>
        </div>

        <div className="max-w-xl mx-auto">
          {/* Header indicator */}
          <div className="grid grid-cols-3 text-center text-xs font-mono uppercase tracking-wider text-slate-400 mb-2">
            <div />
            <div className="text-emerald-400 font-semibold">Predicted: Legitimate</div>
            <div className="text-rose-400 font-semibold">Predicted: Fraud</div>
          </div>

          {/* Actual: Legitimate Row */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="flex items-center justify-end pr-3 text-xs font-mono uppercase text-slate-300">
              Actual: Legitimate
            </div>

            {/* True Negative */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center">
              <span className="text-[10px] font-mono uppercase text-emerald-400 block mb-1">
                True Negative (TN)
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {confusion_matrix.true_negative.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Legit approved correctly</span>
            </div>

            {/* False Positive */}
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-center">
              <span className="text-[10px] font-mono uppercase text-amber-400 block mb-1">
                False Positive (FP)
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {confusion_matrix.false_positive.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">False alarms (user friction)</span>
            </div>
          </div>

          {/* Actual: Fraud Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center justify-end pr-3 text-xs font-mono uppercase text-slate-300">
              Actual: Fraud
            </div>

            {/* False Negative */}
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-center">
              <span className="text-[10px] font-mono uppercase text-rose-400 block mb-1">
                False Negative (FN)
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {confusion_matrix.false_negative.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Missed fraud (financial loss)</span>
            </div>

            {/* True Positive */}
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-center">
              <span className="text-[10px] font-mono uppercase text-emerald-300 block mb-1">
                True Positive (TP)
              </span>
              <span className="text-2xl font-bold font-mono text-white">
                {confusion_matrix.true_positive.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Fraud blocked successfully</span>
            </div>
          </div>
        </div>

        {/* Phase 2 Feature Pipeline Roadmap */}
        <div className="mt-8 pt-6 border-t border-slate-800/60">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Planned Phase 2 Feature Engineering & Explainability
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-blue-400 font-semibold block mb-1">1. Velocity Aggregates</span>
              <span className="text-slate-400">10-min, 1-hr & 24-hr rolling transaction counts & standard dev sums.</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-cyan-400 font-semibold block mb-1">2. Geo-Velocity Index</span>
              <span className="text-slate-400">Impossible travel physics (Haversine distance ÷ elapsed delta t).</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-purple-400 font-semibold block mb-1">3. SHAP Tree Explainer</span>
              <span className="text-slate-400">Attribution values explaining exact feature drivers for each alert.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
