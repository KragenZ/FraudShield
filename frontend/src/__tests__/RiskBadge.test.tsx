import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { RiskBadge } from '../components/common/RiskBadge';
import { SettingsProvider, useSettings } from '../context/SettingsContext';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getSettings: vi.fn()
  }
}));

const mockedApi = vi.mocked(api);

describe('RiskBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies boundary scores accurately using default 50/85 thresholds', async () => {
    mockedApi.getSettings.mockResolvedValue({
      flag_threshold: 50,
      block_threshold: 85,
      auto_block_high_risk: false,
      email_alerts: false
    });

    render(
      <SettingsProvider>
        <div>
          <div data-testid="s0"><RiskBadge score={0} /></div>
          <div data-testid="s49"><RiskBadge score={49} /></div>
          <div data-testid="s50"><RiskBadge score={50} /></div>
          <div data-testid="s84"><RiskBadge score={84} /></div>
          <div data-testid="s85"><RiskBadge score={85} /></div>
          <div data-testid="s100"><RiskBadge score={100} /></div>
        </div>
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(mockedApi.getSettings).toHaveBeenCalled();
    });

    expect(screen.getByTestId('s0')).toHaveTextContent('(LOW)');
    expect(screen.getByTestId('s49')).toHaveTextContent('(LOW)');
    expect(screen.getByTestId('s50')).toHaveTextContent('(MEDIUM)');
    expect(screen.getByTestId('s84')).toHaveTextContent('(MEDIUM)');
    expect(screen.getByTestId('s85')).toHaveTextContent('(CRITICAL)');
    expect(screen.getByTestId('s100')).toHaveTextContent('(CRITICAL)');
  });

  it('updates classification dynamically when settings thresholds change to 30/70', async () => {
    mockedApi.getSettings.mockResolvedValue({
      flag_threshold: 50,
      block_threshold: 85,
      auto_block_high_risk: false,
      email_alerts: false
    });

    const ThresholdChanger = () => {
      const { setSettings } = useSettings();
      return (
        <button
          type="button"
          onClick={() =>
            setSettings({
              flag_threshold: 30,
              block_threshold: 70,
              auto_block_high_risk: false,
              email_alerts: false
            })
          }
        >
          Apply 30/70
        </button>
      );
    };

    render(
      <SettingsProvider>
        <ThresholdChanger />
        <div data-testid="s35"><RiskBadge score={35} /></div>
        <div data-testid="s72"><RiskBadge score={72} /></div>
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(mockedApi.getSettings).toHaveBeenCalled();
    });

    // Under default 50/85
    expect(screen.getByTestId('s35')).toHaveTextContent('(LOW)');
    expect(screen.getByTestId('s72')).toHaveTextContent('(MEDIUM)');

    // Update settings dynamically to 30/70
    fireEvent.click(screen.getByRole('button', { name: 'Apply 30/70' }));

    await waitFor(() => {
      expect(screen.getByTestId('s35')).toHaveTextContent('(MEDIUM)');
      expect(screen.getByTestId('s72')).toHaveTextContent('(CRITICAL)');
    });
  });
});
