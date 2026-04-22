import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, Loan, Tool } from '../types/models';

const STORAGE_KEY = 'handback.state.v1';

const defaultState: AppState = {
  version: 1,
  myName: 'Me',
  tools: [],
  loans: [],
};

export async function loadState(): Promise<AppState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState;
  try {
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || parsed.version !== 1) return defaultState;
    return {
      ...defaultState,
      ...parsed,
      tools: Array.isArray(parsed.tools) ? parsed.tools : [],
      loans: Array.isArray(parsed.loans) ? parsed.loans : [],
    };
  } catch {
    return defaultState;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function resetState(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function updateState(updater: (prev: AppState) => AppState): Promise<AppState> {
  const prev = await loadState();
  const next = updater(prev);
  await saveState(next);
  return next;
}

export async function setMyName(myName: string): Promise<AppState> {
  const cleaned = myName.trim().slice(0, 40) || 'Me';
  return updateState((prev) => ({ ...prev, myName: cleaned }));
}

export async function addTool(tool: Tool): Promise<AppState> {
  return updateState((prev) => ({ ...prev, tools: [tool, ...prev.tools] }));
}

export async function updateTool(tool: Tool): Promise<AppState> {
  return updateState((prev) => ({ ...prev, tools: prev.tools.map((t) => (t.id === tool.id ? tool : t)) }));
}

export async function addLoan(loan: Loan): Promise<AppState> {
  return updateState((prev) => ({ ...prev, loans: [loan, ...prev.loans] }));
}

export async function updateLoan(loan: Loan): Promise<AppState> {
  return updateState((prev) => ({ ...prev, loans: prev.loans.map((l) => (l.id === loan.id ? loan : l)) }));
}
