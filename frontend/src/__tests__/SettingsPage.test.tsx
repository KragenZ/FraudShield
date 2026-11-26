import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from '../pages/SettingsPage';
import { SettingsProvider } from '../context/SettingsContext';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    getHealth: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getHealth.mockResolvedValue({
      status: 'healthy',
      database: { engine: 'sqlite', status: 'connected' }
    });
  });

  it('loads settings from backend and defaults auto_block_high_risk to false', async () => {
    mockedApi.getSettings.mockResolvedValue({
      flag_threshold: 45,
      block_threshold: 80,
      auto_block_high_risk: false,
      email_alerts: true
    });

    render(
      <SettingsProvider>
        <SettingsPage />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('45 / 100')).toBeInTheDocument();
      expect(screen.getByText('80 / 100')).toBeInTheDocument();
    });

    const autoBlockCheckbox = screen.getByLabelText(
      /Automatic Blocking \(Disabled by Default — Human Review Mode\)/i
    ) as HTMLInputElement;
    const emailAlertsCheckbox = screen.getByLabelText(
      /Email Alerts for High-Severity Incidents/i
    ) as HTMLInputElement;

    expect(autoBlockCheckbox.checked).toBe(false);
    expect(emailAlertsCheckbox.checked).toBe(true);
    expect(
      screen.queryByText(/Automatic blocking is active on the baseline\/demo risk engine/i)
    ).not.toBeInTheDocument();
  });

  it('validates flag_threshold < block_threshold client-side before saving', async () => {
    mockedApi.getSettings.mockResolvedValue({
      flag_threshold: 50,
      block_threshold: 85,
      auto_block_high_risk: false,
      email_alerts: false
    });

    render(
      <SettingsProvider>
        <SettingsPage />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('50 / 100')).toBeInTheDocument();
    });

    const flagSlider = screen.getByLabelText(/Under Review \/ Flagged Threshold/i);
    fireEvent.change(flagSlider, { target: { value: '85' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Configuration/i }));

    expect(
      await screen.findByText(/Flag threshold \(85\) must be strictly less than block threshold \(85\)/i)
    ).toBeInTheDocument();
    expect(mockedApi.updateSettings).not.toHaveBeenCalled();
  });

  it('saves updated settings via api.updateSettings and shows warning when auto-block enabled', async () => {
    mockedApi.getSettings.mockResolvedValue({
      flag_threshold: 50,
      block_threshold: 85,
      auto_block_high_risk: false,
      email_alerts: false
    });
    mockedApi.updateSettings.mockResolvedValue({
      flag_threshold: 40,
      block_threshold: 75,
      auto_block_high_risk: true,
      email_alerts: true
    });

    render(
      <SettingsProvider>
        <SettingsPage />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('50 / 100')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Under Review \/ Flagged Threshold/i), {
      target: { value: '40' }
    });
    fireEvent.change(screen.getByLabelText(/High-Risk \/ Automatic Block Threshold/i), {
      target: { value: '75' }
    });
    fireEvent.click(
      screen.getByLabelText(/Automatic Blocking \(Disabled by Default — Human Review Mode\)/i)
    );
    fireEvent.click(screen.getByLabelText(/Email Alerts for High-Severity Incidents/i));

    expect(
      screen.getByText(/Automatic blocking is active on the baseline\/demo risk engine/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Configuration/i }));

    await waitFor(() => {
      expect(mockedApi.updateSettings).toHaveBeenCalledWith({
        flag_threshold: 40,
        block_threshold: 75,
        auto_block_high_risk: true,
        email_alerts: true
      });
    });

    expect(await screen.findByText(/Settings saved successfully!/i)).toBeInTheDocument();
  });

  it('displays backend validation or save errors cleanly', async () => {
    mockedApi.getSettings.mockResolvedValue({
      flag_threshold: 50,
      block_threshold: 85,
      auto_block_high_risk: false,
      email_alerts: false
    });
    mockedApi.updateSettings.mockRejectedValue(
      new Error('flag_threshold (60) must be less than block_threshold (55)')
    );

    render(
      <SettingsProvider>
        <SettingsPage />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('50 / 100')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Configuration/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/flag_threshold \(60\) must be less than block_threshold \(55\)/i);
  });
});
