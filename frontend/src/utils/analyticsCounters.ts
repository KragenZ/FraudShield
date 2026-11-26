import { AnalyticsSummary, Transaction, TransactionStatus } from '../types';

function computeRate(count: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((count / total) * 100).toFixed(2));
}

export function applyLiveTransactionToAnalytics(
  prev: AnalyticsSummary | null,
  newTx: Transaction
): AnalyticsSummary | null {
  if (!prev) return null;

  const totalTransactions = prev.stats.total_transactions + 1;
  const approvedCount =
    (prev.stats.approved_count ?? 0) + (newTx.status === 'APPROVED' ? 1 : 0);
  const underReviewCount =
    (prev.stats.under_review_count ?? 0) + (newTx.status === 'UNDER_REVIEW' ? 1 : 0);
  const flaggedCount =
    (prev.stats.flagged_count ?? 0) + (newTx.status === 'FLAGGED' ? 1 : 0);
  const blockedCount =
    (prev.stats.blocked_count ?? 0) + (newTx.status === 'BLOCKED' ? 1 : 0);

  const fraudDetected = flaggedCount + blockedCount;
  const totalVolume = Number((prev.stats.total_volume + newTx.amount).toFixed(2));

  return {
    ...prev,
    stats: {
      ...prev.stats,
      total_transactions: totalTransactions,
      approved_count: approvedCount,
      under_review_count: underReviewCount,
      flagged_count: flaggedCount,
      blocked_count: blockedCount,
      fraud_detected: fraudDetected,
      approved_rate: computeRate(approvedCount, totalTransactions),
      under_review_rate: computeRate(underReviewCount, totalTransactions),
      flagged_rate: computeRate(flaggedCount, totalTransactions),
      blocked_rate: computeRate(blockedCount, totalTransactions),
      fraud_detection_rate: computeRate(fraudDetected, totalTransactions),
      total_volume: totalVolume
    }
  };
}

export function applyTransactionStatusTransitionToAnalytics(
  prev: AnalyticsSummary | null,
  previousStatus: TransactionStatus | null | undefined,
  nextStatus: TransactionStatus | null | undefined
): AnalyticsSummary | null {
  if (!prev || !previousStatus || !nextStatus || previousStatus === nextStatus) {
    return prev;
  }

  let approvedCount = prev.stats.approved_count ?? 0;
  let underReviewCount = prev.stats.under_review_count ?? 0;
  let flaggedCount = prev.stats.flagged_count ?? 0;
  let blockedCount = prev.stats.blocked_count ?? 0;

  if (previousStatus === 'APPROVED') {
    approvedCount = Math.max(0, approvedCount - 1);
  } else if (previousStatus === 'UNDER_REVIEW') {
    underReviewCount = Math.max(0, underReviewCount - 1);
  } else if (previousStatus === 'FLAGGED') {
    flaggedCount = Math.max(0, flaggedCount - 1);
  } else if (previousStatus === 'BLOCKED') {
    blockedCount = Math.max(0, blockedCount - 1);
  }

  if (nextStatus === 'APPROVED') {
    approvedCount += 1;
  } else if (nextStatus === 'UNDER_REVIEW') {
    underReviewCount += 1;
  } else if (nextStatus === 'FLAGGED') {
    flaggedCount += 1;
  } else if (nextStatus === 'BLOCKED') {
    blockedCount += 1;
  }

  const totalTransactions = prev.stats.total_transactions;
  const fraudDetected = flaggedCount + blockedCount;

  return {
    ...prev,
    stats: {
      ...prev.stats,
      approved_count: approvedCount,
      under_review_count: underReviewCount,
      flagged_count: flaggedCount,
      blocked_count: blockedCount,
      fraud_detected: fraudDetected,
      approved_rate: computeRate(approvedCount, totalTransactions),
      under_review_rate: computeRate(underReviewCount, totalTransactions),
      flagged_rate: computeRate(flaggedCount, totalTransactions),
      blocked_rate: computeRate(blockedCount, totalTransactions),
      fraud_detection_rate: computeRate(fraudDetected, totalTransactions)
    }
  };
}
