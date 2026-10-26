import { createStore } from 'zustand/vanilla';
import { defaultPreferences, preferencesSchema, type Preferences } from '@fintrack/shared';

export const PREFERENCES_KEY = 'fintrack.preferences.v1';
export interface PreferenceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
interface PreferenceState {
  value: Preferences;
  status: 'loading' | 'ready' | 'error';
  saving: boolean;
  error: 'read' | 'invalid' | 'write' | null;
  hydrate(): Promise<void>;
  update(patch: Partial<Pick<Preferences, 'theme' | 'hideAmounts'>>): Promise<boolean>;
  reset(): Promise<boolean>;
}

export function createPreferences(storage: PreferenceStorage) {
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const result = queue.then(action);
    queue = result.catch(() => undefined);
    return result;
  };
  return createStore<PreferenceState>((set, get) => ({
    value: { ...defaultPreferences },
    status: 'loading',
    saving: false,
    error: null,
    hydrate: () =>
      enqueue(async () => {
        set({ status: 'loading', error: null });
        let raw: string | null;
        try {
          raw = await storage.getItem(PREFERENCES_KEY);
        } catch {
          set({ status: 'error', error: 'read' });
          return;
        }
        try {
          const value =
            raw === null ? { ...defaultPreferences } : preferencesSchema.parse(JSON.parse(raw));
          set({ value, status: 'ready', error: null });
        } catch {
          set({ status: 'error', error: 'invalid' });
        }
      }),
    update: (patch) =>
      enqueue(async () => {
        if (get().status !== 'ready') return false;
        const value = preferencesSchema.parse({ ...get().value, ...patch });
        set({ saving: true, error: null });
        try {
          await storage.setItem(PREFERENCES_KEY, JSON.stringify(value));
          set({ value, saving: false });
          return true;
        } catch {
          set({ saving: false, error: 'write' });
          return false;
        }
      }),
    reset: () =>
      enqueue(async () => {
        set({ saving: true, error: null });
        try {
          await storage.removeItem(PREFERENCES_KEY);
          set({ value: { ...defaultPreferences }, status: 'ready', saving: false });
          return true;
        } catch {
          set({ saving: false, error: 'write' });
          return false;
        }
      }),
  }));
}
