import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ModelPerformancePage } from '../pages/ModelPerformancePage';
import { api } from '../services/api';
import { ModelPerformanceMetrics } from '../types';

vi.mock('../services/api', () => ({
  api: {
    getModelMetrics: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

const SAMPLE_METRICS: ModelPerformanceMetrics = {
  model_name: 'FraudShield Ensemble (Phase 1 Target)',
  model_version: 'v0.1-baseline',
  evaluated_at: '2026-11-26T10:00:00Z',
  precision: 0.942,
  recall: 0.895,
  f1_score: 0.918,
  pr_auc: 0.931,
  roc_auc: 0.978,
  confusion_matrix: {
    true_positive: 448,
    false_positive: 28,
    true_negative: 9472,
    false_negative: 52
  },
  status: 'DEMO_BASELINE',
  is_demo_data: true
};

describe('ModelPerformancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clearly labels all metrics as static pre-training demo/baseline telemetry', async () => {
    mockedApi.getModelMetrics.mockResolvedValue(SAMPLE_METRICS);

    render(<ModelPerformancePage />);

    await waitFor(() => {
      expect(screen.getByText('DEMO BASELINE')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Static pre-training target benchmark (Demo Telemetry — no trained ML model active)')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Illustrative baseline confusion matrix \(10,000 synthetic target samples — Demo Telemetry\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Target benchmark — Accuracy:/i)).toBeInTheDocument();
    expect(screen.getByText(/Target benchmark — ROC-AUC:/i)).toBeInTheDocument();

    expect(screen.queryByText(/Evaluated on holdout validation slice/i)).not.toBeInTheDocument();
    expect(screen.queryByText('AUDIT READY')).not.toBeInTheDocument();
  });
});
