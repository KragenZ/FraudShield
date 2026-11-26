export type TransactionStatus = 'APPROVED' | 'FLAGGED' | 'BLOCKED' | 'UNDER_REVIEW';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface SystemSettings {
  flag_threshold: number;
  block_threshold: number;
  auto_block_high_risk: boolean;
  email_alerts: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface SystemSettingsUpdate {
  flag_threshold?: number;
  block_threshold?: number;
  auto_block_high_risk?: boolean;
  email_alerts?: boolean;
  updated_by?: string;
}

export interface Transaction {
  id: string;
  customer_id: string;
  customer_name?: string;
  amount: number;
  currency: string;
  transaction_type: string;
  timestamp: string;
  fraud_probability: number;
  risk_score: number;
  status: TransactionStatus;
  merchant?: string;
  location?: string;
  ip_address?: string;
  device_type?: string;
  is_demo_data: boolean;
}

export interface FraudAlert {
  id: string;
  transaction_id: string;
  severity: AlertSeverity;
  risk_score: number;
  reason: string;
  status: AlertStatus;
  created_at: string;
  updated_at: string;
  reviewed_by?: string;
  resolution_notes?: string;
  is_demo_data: boolean;
  transaction?: Transaction;
}

export interface OverviewStats {
  total_transactions: number;
  fraud_detected: number;
  fraud_detection_rate: number;
  total_volume: number;
  high_risk_alerts: number;
  resolved_alerts: number;
  average_risk_score: number;
  approved_count?: number;
  under_review_count?: number;
  flagged_count?: number;
  blocked_count?: number;
  approved_rate?: number;
  under_review_rate?: number;
  flagged_rate?: number;
  blocked_rate?: number;
}

export interface FraudTrendPoint {
  time_label: string;
  total_count: number;
  fraud_count: number;
  total_volume: number;
  fraud_volume: number;
  under_review_count?: number;
  under_review_volume?: number;
}

export interface TransactionTypeBreakdown {
  type_name: string;
  count: number;
  volume: number;
  fraud_count: number;
  under_review_count?: number;
}

export interface AnalyticsSummary {
  stats: OverviewStats;
  trends: FraudTrendPoint[];
  type_distribution: TransactionTypeBreakdown[];
  is_demo_data: boolean;
}

export interface ConfusionMatrix {
  true_positive: number;
  false_positive: number;
  true_negative: number;
  false_negative: number;
}

export interface ModelPerformanceMetrics {
  model_name: string;
  model_version: string;
  evaluated_at: string;
  precision: number;
  recall: number;
  f1_score: number;
  pr_auc: number;
  roc_auc: number;
  confusion_matrix: ConfusionMatrix;
  status: string;
  is_demo_data: boolean;
}

export interface TransactionListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  transactions: Transaction[];
}

export interface AlertListResponse {
  total: number;
  unresolved_count: number;
  alerts: FraudAlert[];
  page: number;
  page_size: number;
  total_pages: number;
}
