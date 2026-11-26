import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AlertReviewModal } from '../components/modals/AlertReviewModal';
import { FraudAlert } from '../types';

function makeAlert(overrides: Partial<FraudAlert> = {}): FraudAlert {
  return {
    id: 'ALT-1001',
    transaction_id: 'TX-9001',
    severity: 'HIGH',
    risk_score: 82,
    reason: 'High-velocity cross-border wire transfer',
    status: 'NEW',
    created_at: '2026-11-26T10:00:00Z',
    updated_at: '2026-11-26T10:00:00Z',
    is_demo_data: true,
    ...overrides
  };
}

describe('AlertReviewModal', () => {
  it('allows selecting and submitting FALSE_POSITIVE disposition', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<AlertReviewModal alert={makeAlert()} onClose={onClose} onSave={onSave} />);

    expect(screen.getByText('Restore transaction to Approved')).toBeInTheDocument();
    expect(screen.getByText('Flag transaction (no auto-block)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /False Positive/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Elena R\./i), {
      target: { value: 'Elena R.' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Contacted cardholder/i), {
      target: { value: 'Verified legitimate customer wire' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Resolution/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('ALT-1001', {
        status: 'FALSE_POSITIVE',
        reviewed_by: 'Elena R.',
        resolution_notes: 'Verified legitimate customer wire'
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('allows selecting and submitting CONFIRMED_FRAUD disposition', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<AlertReviewModal alert={makeAlert()} onClose={onClose} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: /Confirmed Fraud/i }));
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Elena R\./i), {
      target: { value: 'Marcus T.' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Contacted cardholder/i), {
      target: { value: 'Account takeover confirmed with cardholder' }
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Resolution/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('ALT-1001', {
        status: 'CONFIRMED_FRAUD',
        reviewed_by: 'Marcus T.',
        resolution_notes: 'Account takeover confirmed with cardholder'
      });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
