import type { AppState, Command } from '../types/models.ts';
import { applyCommand, createState, migrateLegacy, validateState } from '../domain/state.ts';

/** The baseline key is kept so old installs remain discoverable for migration. */
export const LEGACY_STORAGE_KEY = 'handback.state.v1';
/** New snapshots use a distinct key while the raw baseline remains recoverable. */
export const STORAGE_KEY = 'handback.state.v2';
/** Explicit replacement keeps the previous raw snapshot available for recovery. */
export const RECOVERY_STORAGE_KEY = 'handback.state.recovery';

type MaybePromise<T> = T | Promise<T>;

/** Minimal key-value boundary used by the repository and its tests. */
export type StorageAdapter = {
  getItem(key: string): MaybePromise<string | null>;
  setItem(key: string, value: string): MaybePromise<void>;
};

export type StateUpdater = (previous: AppState) => AppState;

export type StateRepository = {
  loadState(): Promise<AppState>;
  dispatch(command: Command): Promise<AppState>;
  replaceState(state: AppState): Promise<AppState>;
  updateState(updater: StateUpdater): Promise<AppState>;
};

type RepositoryOptions = { profileId?: string };

let nativeStoragePromise: Promise<StorageAdapter> | undefined;

async function nativeStorage(): Promise<StorageAdapter> {
  if (!nativeStoragePromise) {
    // Keep the native package out of the domain and out of Node's focused tests.
    nativeStoragePromise = import('@react-native-async-storage/async-storage').then(
      (module) => module.default,
    );
  }
  return nativeStoragePromise;
}

function generatedId(prefix: string): string {
  const cryptoValue = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const suffix = cryptoValue?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${suffix}`;
}

function enqueue<T>(tail: { current: Promise<void> }, operation: () => Promise<T>): Promise<T> {
  const next = tail.current.then(operation, operation);
  tail.current = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function parseRaw(raw: string, key: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Could not read HandBack data from ${key}`);
  }
}

/**
 * Create an isolated serialized state repository. Passing an adapter is useful
 * for tests and for alternate local storage implementations; production uses
 * AsyncStorage lazily so importing the domain remains platform independent.
 */
export function createRepository(
  adapter?: StorageAdapter,
  options: RepositoryOptions = {},
): StateRepository {
  const tail = { current: Promise.resolve() };
  let profileId = options.profileId;
  let storagePromise: Promise<StorageAdapter> | undefined;

  async function storage(): Promise<StorageAdapter> {
    if (adapter) return adapter;
    if (!storagePromise) storagePromise = nativeStorage();
    return storagePromise;
  }

  async function ensureProfileId(): Promise<string> {
    if (!profileId && !adapter) {
      try {
        const module = await import('../lib/id.ts');
        profileId = await module.newId('profile');
      } catch {
        // Expo's native random source is unavailable in a few development
        // environments; the local fallback still gives each snapshot a stable
        // identity for the lifetime of this repository instance.
      }
    }
    if (!profileId) profileId = generatedId('profile');
    return profileId;
  }

  async function writeCurrent(state: AppState): Promise<void> {
    const value = JSON.stringify(state);
    await (await storage()).setItem(STORAGE_KEY, value);
  }

  async function readRaw(key: string): Promise<string | null> {
    return (await storage()).getItem(key);
  }

  async function readSnapshot(): Promise<AppState> {
    const currentRaw = await readRaw(STORAGE_KEY);
    if (currentRaw !== null) {
      const parsed = parseRaw(currentRaw, STORAGE_KEY);
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        (parsed as { version?: unknown }).version === 2
      ) {
        return validateState(parsed);
      }
      // A v1 snapshot should normally live at the legacy key, but handling it
      // here makes a partially upgraded install recoverable without guessing.
      const migrated = migrateLegacy(parsed, await ensureProfileId());
      await (await storage()).setItem(RECOVERY_STORAGE_KEY, currentRaw);
      await writeCurrent(migrated);
      return migrated;
    }

    const legacyRaw = await readRaw(LEGACY_STORAGE_KEY);
    if (legacyRaw !== null) {
      const parsed = parseRaw(legacyRaw, LEGACY_STORAGE_KEY);
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed) &&
        (parsed as { version?: unknown }).version === 2
      ) {
        const normalized = validateState(parsed);
        await writeCurrent(normalized);
        return normalized;
      }
      // Leave the original v1 value in place. If the migration or write fails,
      // the next attempt can retry from exactly the same source data.
      const migrated = migrateLegacy(parsed, await ensureProfileId());
      await writeCurrent(migrated);
      return migrated;
    }

    const initial = createState(await ensureProfileId());
    await writeCurrent(initial);
    return initial;
  }

  async function loadState(): Promise<AppState> {
    return enqueue(tail, readSnapshot);
  }

  async function dispatch(command: Command): Promise<AppState> {
    return enqueue(tail, async () => {
      const previous = await readSnapshot();
      const next = applyCommand(previous, command);
      await writeCurrent(next);
      return next;
    });
  }

  async function replaceState(state: AppState): Promise<AppState> {
    return enqueue(tail, async () => {
      const next = validateState(state);
      // Replacement is an explicit recovery/restore operation. Preserve the
      // raw current value before attempting to overwrite it so a failed or
      // mistaken restore remains diagnosable and recoverable.
      const currentRaw = await readRaw(STORAGE_KEY);
      const legacyRaw = currentRaw === null ? await readRaw(LEGACY_STORAGE_KEY) : null;
      const previousRaw = currentRaw ?? legacyRaw;
      if (previousRaw !== null) {
        await (await storage()).setItem(RECOVERY_STORAGE_KEY, previousRaw);
      }
      await writeCurrent(next);
      return next;
    });
  }

  async function updateState(updater: StateUpdater): Promise<AppState> {
    return enqueue(tail, async () => {
      const previous = await readSnapshot();
      const candidate = updater(previous);
      const next = validateState(candidate);
      await writeCurrent(next);
      return next;
    });
  }

  return { loadState, dispatch, replaceState, updateState };
}

const defaultRepository = createRepository();

export const loadState = (): Promise<AppState> => defaultRepository.loadState();
export const dispatch = (command: Command): Promise<AppState> => defaultRepository.dispatch(command);
export const replaceState = (state: AppState): Promise<AppState> => defaultRepository.replaceState(state);
export const updateState = (updater: StateUpdater): Promise<AppState> => defaultRepository.updateState(updater);
