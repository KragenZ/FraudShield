import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { SystemSettings } from '../types';
import { api } from '../services/api';
import { DEFAULT_SETTINGS } from '../utils/riskPolicy';

interface SettingsContextValue {
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  isLoading: boolean;
  error: string | null;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  setSettings: () => {},
  isLoading: false,
  error: null,
  refreshSettings: async () => {}
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await api.getSettings();
      setSettings(loaded);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadInitialSettings = async () => {
      try {
        const loaded = await api.getSettings();
        if (!cancelled) {
          setSettings(loaded);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load settings';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        setSettings,
        isLoading,
        error,
        refreshSettings
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// eslint-disable-next-line react/only-export-components
export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
