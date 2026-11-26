import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertsPage } from '../pages/AlertsPage';
import { api } from '../services/api';
import { FraudAlert } from '../types';

vi.mock('../services/api', () => ({
  api: {
    getAlerts: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

function makeAlert(id: string): FraudAlert {
  return {
    id,
    transaction_id: `TX-${id}`,
    severity: 'HIGH',
    risk_score: 78,
    reason: 'Elevated transfer velocity',
    status: 'NEW',
    created_at: '2026-11-26T10:00:00Z',
    updated_at: '2026-11-26T10:00:00Z',
    is_demo_data: true
  };
}

describe('AlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests server-side pagination, advances pages, and resets to page 1 on filter changes', async () => {
    mockedApi.getAlerts.mockImplementation(async (params) => {
      const page = params?.page ?? 1;
      return {
        total: 25,
        unresolved_count: 18,
        page,
        page_size: 10,
        total_pages: 3,
        alerts: [makeAlert(`ALT-${page}-1`), makeAlert(`ALT-${page}-2`)]
      };
    });

    render(<AlertsPage onSelectAlert={vi.fn()} refreshTrigger={0} />);

    await waitFor(() => {
      expect(mockedApi.getAlerts).toHaveBeenCalledWith({
        status: 'ALL',
        severity: 'ALL',
        limit: 10,
        page: 1
      });
    });

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('18 active incidents awaiting security verification')).toBeInTheDocument();

    // Advance to page 2
    fireEvent.click(screen.getByRole('button', { name: /Next alerts page/i }));

    await waitFor(() => {
      expect(mockedApi.getAlerts).toHaveBeenLastCalledWith({
        status: 'ALL',
        severity: 'ALL',
        limit: 10,
        page: 2
      });
    });
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    // Status filter change resets page to 1
    fireEvent.click(screen.getByRole('button', { name: 'NEW' }));

    await waitFor(() => {
      expect(mockedApi.getAlerts).toHaveBeenLastCalledWith({
        status: 'NEW',
        severity: 'ALL',
        limit: 10,
        page: 1
      });
    });

    // Advance to page 2 again, then severity filter resets page to 1
    fireEvent.click(screen.getByRole('button', { name: /Next alerts page/i }));
    await waitFor(() => {
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Severity:/i), { target: { value: 'CRITICAL' } });

    await waitFor(() => {
      expect(mockedApi.getAlerts).toHaveBeenLastCalledWith({
        status: 'NEW',
        severity: 'CRITICAL',
        limit: 10,
        page: 1
      });
    });
  });
});
