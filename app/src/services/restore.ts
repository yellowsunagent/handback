import type { AppState } from '../types/models.ts';

export type RestoreResult = { state: AppState; reminderError?: string };

/** Commit only after caller confirmation; notification failure never undoes saved data. */
export async function completeRestore(candidate: AppState, effects: {
  replace(state: AppState): Promise<AppState>;
  reconcile(state: AppState): Promise<void>;
  discard(state: AppState): Promise<void>;
}): Promise<RestoreResult> {
  try {
    const state = await effects.replace(candidate);
    try {
      await effects.reconcile(state);
      return { state };
    } catch (error) {
      return { state, reminderError: error instanceof Error ? error.message : 'Local reminders could not be refreshed.' };
    }
  } finally {
    // The native discard checks committed references before removing staged photos.
    await effects.discard(candidate).catch(() => undefined);
  }
}
