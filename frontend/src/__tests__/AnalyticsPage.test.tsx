import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsPage } from '../pages/AnalyticsPage';
import { AnalyticsSummary } from '../types';

describe('AnalyticsPage', () => {
  it('renders APPROVED, UNDER_REVIEW, FLAGGED, and BLOCKED distinctly without folding UNDER_REVIEW into Legitimate', () => {
    const analytics: AnalyticsSummary = {
      is_demo_data: true,
      stats: {
        total_transactions: 100,
        approved_count: 60,
        under_review_count: 25,
        flagged_count: 10,
        blocked_count: 5,
        approved_rate: 60,
        under_review_rate: 25,
        flagged_rate: 10,
        blocked_rate: 5,
        fraud_detected: 15,
        fraud_detection_rate: 15,
        total_volume: 125000,
        high_risk_alerts: 8,
        resolved_alerts: 4,
        average_risk_score: 42.5
      },
      trends: [
        {
          time_label: 'Nov 25',
          total_count: 100,
          fraud_count: 15,
          total_volume: 125000,
          fraud_volume: 30000,
          under_review_count: 25,
          under_review_volume: 20000
        }
      ],
      type_distribution: [
        {
          type_name: 'WIRE_TRANSFER',
          count: 100,
          volume: 125000,
          fraud_count: 15,
          under_review_count: 25
        }
      ]
    };

    render(<AnalyticsPage analytics={analytics} isLoading={false} />);

    expect(screen.getByText(/Approved \(Legitimate\)/i)).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('60% of all traffic')).toBeInTheDocument();

    // Ensure UNDER_REVIEW (25) is NOT merged into Approved (which would be 85)
    expect(screen.queryByText('85')).not.toBeInTheDocument();

    expect(screen.getByText('Under Review', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('25% awaiting human review')).toBeInTheDocument();

    expect(screen.getByText('Flagged')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('10% suspicious triggers')).toBeInTheDocument();

    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('5% high-risk blocked')).toBeInTheDocument();

    expect(screen.getByText('Total Fraud Triggers')).toBeInTheDocument();
    expect(screen.getByText('Resolved Alerts')).toBeInTheDocument();
    expect(screen.getByText('Mean Risk Index')).toBeInTheDocument();
    expect(screen.getByText('42.5 / 100')).toBeInTheDocument();
  });
});
