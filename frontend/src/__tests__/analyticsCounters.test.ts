import { describe, it, expect } from 'vitest';
import {
  applyLiveTransactionToAnalytics,
  applyTransactionStatusTransitionToAnalytics
} from '../utils/analyticsCounters';
import { AnalyticsSummary, Transaction, TransactionStatus } from '../types';

function makeBaseAnalytics(): AnalyticsSummary {
  return {
    is_demo_data: true,
    stats: {
      total_transactions: 10,
      approved_count: 6,
      under_review_count: 2,
      flagged_count: 1,
      blocked_count: 1,
      approved_rate: 60,
      under_review_rate: 20,
      flagged_rate: 10,
      blocked_rate: 10,
      fraud_detected: 2,
      fraud_detection_rate: 20,
      total_volume: 1000,
      high_risk_alerts: 2,
      resolved_alerts: 0,
      average_risk_score: 35
    },
    trends: [],
    type_distribution: []
  };
}

function makeTx(status: TransactionStatus, amount = 250.5): Transaction {
  return {
    id: 'TX-LIVE-1',
    customer_id: 'CUST-1',
    amount,
    currency: 'USD',
    transaction_type: 'WIRE_TRANSFER',
    timestamp: '2026-11-26T10:00:00Z',
    fraud_probability: 0.4,
    risk_score: 55,
    status,
    is_demo_data: true
  };
}

describe('applyLiveTransactionToAnalytics', () => {
  it('returns null when previous analytics state is null', () => {
    expect(applyLiveTransactionToAnalytics(null, makeTx('APPROVED'))).toBeNull();
  });

  it('increments only approved_count and recalculates rates on APPROVED', () => {
    const next = applyLiveTransactionToAnalytics(makeBaseAnalytics(), makeTx('APPROVED', 100.25));
    expect(next?.stats.total_transactions).toBe(11);
    expect(next?.stats.approved_count).toBe(7);
    expect(next?.stats.under_review_count).toBe(2);
    expect(next?.stats.flagged_count).toBe(1);
    expect(next?.stats.blocked_count).toBe(1);
    expect(next?.stats.fraud_detected).toBe(2);
    expect(next?.stats.approved_rate).toBe(63.64);
    expect(next?.stats.fraud_detection_rate).toBe(18.18);
    expect(next?.stats.total_volume).toBe(1100.25);
  });

  it('keeps UNDER_REVIEW separate from both approved_count and fraud_detected', () => {
    const next = applyLiveTransactionToAnalytics(makeBaseAnalytics(), makeTx('UNDER_REVIEW', 500));
    expect(next?.stats.total_transactions).toBe(11);
    expect(next?.stats.approved_count).toBe(6);
    expect(next?.stats.under_review_count).toBe(3);
    expect(next?.stats.flagged_count).toBe(1);
    expect(next?.stats.blocked_count).toBe(1);
    expect(next?.stats.fraud_detected).toBe(2);
    expect(next?.stats.under_review_rate).toBe(27.27);
    expect(next?.stats.approved_rate).toBe(54.55);
  });

  it('increments flagged_count and fraud_detected on FLAGGED', () => {
    const next = applyLiveTransactionToAnalytics(makeBaseAnalytics(), makeTx('FLAGGED', 200));
    expect(next?.stats.flagged_count).toBe(2);
    expect(next?.stats.blocked_count).toBe(1);
    expect(next?.stats.fraud_detected).toBe(3);
    expect(next?.stats.flagged_rate).toBe(18.18);
    expect(next?.stats.fraud_detection_rate).toBe(27.27);
  });

  it('increments blocked_count and fraud_detected on BLOCKED', () => {
    const next = applyLiveTransactionToAnalytics(makeBaseAnalytics(), makeTx('BLOCKED', 300));
    expect(next?.stats.blocked_count).toBe(2);
    expect(next?.stats.flagged_count).toBe(1);
    expect(next?.stats.fraud_detected).toBe(3);
    expect(next?.stats.blocked_rate).toBe(18.18);
    expect(next?.stats.fraud_detection_rate).toBe(27.27);
  });
});

describe('applyTransactionStatusTransitionToAnalytics', () => {
  it('returns previous state unchanged when analytics is null or statuses are missing/identical', () => {
    const base = makeBaseAnalytics();
    expect(applyTransactionStatusTransitionToAnalytics(null, 'UNDER_REVIEW', 'APPROVED')).toBeNull();
    expect(applyTransactionStatusTransitionToAnalytics(base, undefined, 'APPROVED')).toBe(base);
    expect(applyTransactionStatusTransitionToAnalytics(base, 'UNDER_REVIEW', null)).toBe(base);
    expect(applyTransactionStatusTransitionToAnalytics(base, 'BLOCKED', 'BLOCKED')).toBe(base);
  });

  it('transitions UNDER_REVIEW -> APPROVED on FALSE_POSITIVE and recalculates rates', () => {
    const next = applyTransactionStatusTransitionToAnalytics(
      makeBaseAnalytics(),
      'UNDER_REVIEW',
      'APPROVED'
    );
    expect(next?.stats.total_transactions).toBe(10);
    expect(next?.stats.under_review_count).toBe(1);
    expect(next?.stats.approved_count).toBe(7);
    expect(next?.stats.flagged_count).toBe(1);
    expect(next?.stats.blocked_count).toBe(1);
    expect(next?.stats.fraud_detected).toBe(2);
    expect(next?.stats.under_review_rate).toBe(10);
    expect(next?.stats.approved_rate).toBe(70);
    expect(next?.stats.fraud_detection_rate).toBe(20);
  });

  it('transitions FLAGGED -> APPROVED on FALSE_POSITIVE and decrements fraud_detected', () => {
    const next = applyTransactionStatusTransitionToAnalytics(
      makeBaseAnalytics(),
      'FLAGGED',
      'APPROVED'
    );
    expect(next?.stats.flagged_count).toBe(0);
    expect(next?.stats.blocked_count).toBe(1);
    expect(next?.stats.approved_count).toBe(7);
    expect(next?.stats.fraud_detected).toBe(1);
    expect(next?.stats.flagged_rate).toBe(0);
    expect(next?.stats.approved_rate).toBe(70);
    expect(next?.stats.fraud_detection_rate).toBe(10);
  });

  it('transitions UNDER_REVIEW -> FLAGGED on CONFIRMED_FRAUD and increments fraud_detected', () => {
    const next = applyTransactionStatusTransitionToAnalytics(
      makeBaseAnalytics(),
      'UNDER_REVIEW',
      'FLAGGED'
    );
    expect(next?.stats.under_review_count).toBe(1);
    expect(next?.stats.flagged_count).toBe(2);
    expect(next?.stats.blocked_count).toBe(1);
    expect(next?.stats.fraud_detected).toBe(3);
    expect(next?.stats.under_review_rate).toBe(10);
    expect(next?.stats.flagged_rate).toBe(20);
    expect(next?.stats.fraud_detection_rate).toBe(30);
  });

  it('treats BLOCKED -> BLOCKED on CONFIRMED_FRAUD as a no-op', () => {
    const base = makeBaseAnalytics();
    const next = applyTransactionStatusTransitionToAnalytics(base, 'BLOCKED', 'BLOCKED');
    expect(next).toBe(base);
    expect(next?.stats.blocked_count).toBe(1);
    expect(next?.stats.fraud_detected).toBe(2);
  });
});
