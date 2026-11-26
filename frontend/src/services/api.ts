import {
  Transaction,
  TransactionListResponse,
  AlertListResponse,
  FraudAlert,
  AnalyticsSummary,
  ModelPerformanceMetrics,
  SystemSettings,
  SystemSettingsUpdate
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

function formatApiError(detail: unknown, status: number): string {
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const errObj = item as { msg?: unknown; loc?: unknown };
          const msg = typeof errObj.msg === 'string' ? errObj.msg : JSON.stringify(item);
          if (Array.isArray(errObj.loc) && errObj.loc.length > 0) {
            const locParts = errObj.loc.filter((part) => part !== 'body');
            return locParts.length > 0 ? `${locParts.join('.')}: ${msg}` : msg;
          }
          return msg;
        }
        return String(item);
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join('; ');
    }
  }

  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }

  return `HTTP error! status: ${status}`;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { detail?: unknown };
      throw new Error(formatApiError(errorData.detail, response.status));
    }

    return await response.json();
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // System Health
  getHealth: () => request<Record<string, unknown>>('/health'),

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
  getAlerts: (params?: { status?: string; severity?: string; limit?: number; page?: number }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.severity && params.severity !== 'ALL') query.append('severity', params.severity);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.page) query.append('page', params.page.toString());

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

  // Settings
  getSettings: () => request<SystemSettings>('/settings'),

  updateSettings: (data: SystemSettingsUpdate) =>
    request<SystemSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Model Performance
  getModelMetrics: () => request<ModelPerformanceMetrics>('/model/metrics')
};
