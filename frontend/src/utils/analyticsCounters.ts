import { AnalyticsSummary, Transaction } from '../types';

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
