import React from 'react';
import { AppState as NativeAppState } from 'react-native';
import type { AppState, Command } from '../types/models';
import { dispatch, loadState, replaceState, updateState } from '../storage/store';
import { localDay } from '../domain/dates';

type StateUpdater = (previous: AppState) => AppState;

type AppContextValue = {
  state: AppState | null;
  loading: boolean;
  error: string | null;
  today: string;
  refresh: () => Promise<AppState>;
  commit: (command: Command) => Promise<AppState>;
  apply: (updater: StateUpdater) => Promise<AppState>;
  replace: (next: AppState) => Promise<AppState>;
};

const Context = React.createContext<AppContextValue | null>(null);

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Could not read local HandBack data.';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AppState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [today, setToday] = React.useState(() => localDay());

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadState();
      setState(next);
      setError(null);
      return next;
    } catch (caught) {
      throw caught;
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  React.useEffect(() => {
    const updateDay = () => setToday(localDay());
    const timer = setInterval(updateDay, 60_000);
    const subscription = NativeAppState.addEventListener('change', (next) => {
      if (next === 'active') updateDay();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const commit = React.useCallback(async (command: Command) => {
    try {
      const next = await dispatch(command);
      setState(next);
      setError(null);
      return next;
    } catch (caught) {
      throw caught;
    }
  }, []);

  const apply = React.useCallback(async (updater: StateUpdater) => {
    try {
      const next = await updateState(updater);
      setState(next);
      setError(null);
      return next;
    } catch (caught) {
      throw caught;
    }
  }, []);

  const replace = React.useCallback(async (nextState: AppState) => {
    try {
      const next = await replaceState(nextState);
      setState(next);
      setError(null);
      return next;
    } catch (caught) {
      setError(errorMessage(caught));
      throw caught;
    }
  }, []);

  const value = React.useMemo(() => ({ state, loading, error, today, refresh, commit, apply, replace }), [state, loading, error, today, refresh, commit, apply, replace]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp(): AppContextValue {
  const value = React.useContext(Context);
  if (!value) throw new Error('useApp must be used within AppProvider');
  return value;
}
