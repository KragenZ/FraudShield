import {
  Transaction,
  TransactionListResponse,
  AlertListResponse,
  FraudAlert,
  AnalyticsSummary,
  ModelPerformanceMetrics
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Trans-Type': 'application/json',
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // System Health
  getHealth: () => request<any>('/health'),

  // Analytics & Summary
  getAnalyticsSummary: () => request<AnalyticsSummary>('/analytics/summary'),

  // Transactions
  getTransactions: (params?: {
    page?: number;
    page_size?: number;
    search?: string;
    status?: string;
    transaction_type?: string;
    min_risk?: number;
    max_risk?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.page_size) query.append('page_size', params.page_size.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.transaction_type && params.transaction_type !== 'ALL') {
      query.append('transaction_type', params.transaction_type);
    }
    if (params?.min_risk !== undefined) query.append('min_risk', params.min_risk.toString());
    if (params?.max_risk !== undefined) query.append('max_risk', params.max_risk.toString());

    const qs = query.toString();
    return request<TransactionListResponse>(`/transactions${qs ? `?${qs}` : ''}`);
  },

  getTransaction: (id: string) => request<Transaction>(`/transactions/${id}`),

  createTransaction: (data: Partial<Transaction>) =>
    request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Alerts
  getAlerts: (params?: { status?: string; severity?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.severity && params.severity !== 'ALL') query.append('severity', params.severity);
    if (params?.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    return request<AlertListResponse>(`/alerts${qs ? `?${qs}` : ''}`);
  },

  getAlert: (id: string) => request<FraudAlert>(`/alerts/${id}`),

  updateAlertStatus: (
    id: string,
    data: { status: string; reviewed_by?: string; resolution_notes?: string }
  ) =>
    request<FraudAlert>(`/alerts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),

  // Model Performance
  getModelMetrics: () => request<ModelPerformanceMetrics>('/model/metrics')
};
