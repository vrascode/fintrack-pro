import { createStore } from 'zustand/vanilla';
import { z } from 'zod';
import { createDemoDataset, financialDatasetSchema, type FinancialDataset } from '@fintrack/shared';

export const DEMO_DATA_KEY = 'fintrack.demo.v1';

export interface DemoStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

type DemoMode = 'inactive' | 'demo';
type DemoError = 'read' | 'invalid' | 'write' | null;

interface DemoState {
  status: 'loading' | 'ready' | 'error';
  mode: DemoMode;
  dataset: FinancialDataset | null;
  saving: boolean;
  error: DemoError;
  hydrate(): Promise<void>;
  enterDemo(referenceMonth?: string): Promise<boolean>;
  exitDemo(): Promise<boolean>;
  restoreDemo(referenceMonth?: string): Promise<boolean>;
  updateDataset(update: (current: FinancialDataset) => unknown): Promise<boolean>;
}

const recordSchema = z
  .object({ version: z.literal(1), active: z.boolean(), dataset: financialDatasetSchema })
  .strict();

function encodeRecord(active: boolean, dataset: FinancialDataset): string {
  return JSON.stringify(recordSchema.parse({ version: 1, active, dataset }));
}

function parseRecord(raw: string): { version: 1; active: boolean; dataset: FinancialDataset } {
  return recordSchema.parse(JSON.parse(raw));
}

export function createDemoStore(storage: DemoStorage) {
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(action: () => Promise<T>): Promise<T> => {
    const result = queue.then(action);
    queue = result.catch(() => undefined);
    return result;
  };
  const persist = async (
    active: boolean,
    dataset: FinancialDataset,
    set: (state: Partial<DemoState>) => void,
  ) => {
    set({ saving: true, error: null });
    try {
      await storage.setItem(DEMO_DATA_KEY, encodeRecord(active, dataset));
      set({
        status: 'ready',
        mode: active ? 'demo' : 'inactive',
        dataset,
        saving: false,
        error: null,
      });
      return true;
    } catch {
      set({ saving: false, error: 'write' });
      return false;
    }
  };

  return createStore<DemoState>((set, get) => ({
    status: 'loading',
    mode: 'inactive',
    dataset: null,
    saving: false,
    error: null,
    hydrate: () =>
      enqueue(async () => {
        set({ status: 'loading', error: null });
        let raw: string | null;
        try {
          raw = await storage.getItem(DEMO_DATA_KEY);
        } catch {
          set({ status: 'error', error: 'read' });
          return;
        }
        if (raw === null) {
          set({ status: 'ready', mode: 'inactive', dataset: null, error: null });
          return;
        }
        try {
          const record = parseRecord(raw);
          set({
            status: 'ready',
            mode: record.active ? 'demo' : 'inactive',
            dataset: record.dataset,
            error: null,
          });
        } catch {
          set({ status: 'error', mode: 'inactive', dataset: null, error: 'invalid' });
        }
      }),
    enterDemo: (referenceMonth) =>
      enqueue(async () => {
        if (get().status !== 'ready') return false;
        const dataset = get().dataset ?? createDemoDataset(referenceMonth);
        return persist(true, dataset, set);
      }),
    exitDemo: () =>
      enqueue(async () => {
        const { status, dataset } = get();
        if (status !== 'ready' || !dataset) return false;
        return persist(false, dataset, set);
      }),
    restoreDemo: (referenceMonth) =>
      enqueue(async () => {
        const { status } = get();
        if (status === 'loading' || (status === 'error' && get().error === 'read')) return false;
        try {
          const dataset = createDemoDataset(referenceMonth);
          return persist(true, dataset, set);
        } catch {
          set({ saving: false, error: 'invalid' });
          return false;
        }
      }),
    updateDataset: (update) =>
      enqueue(async () => {
        const { status, mode, dataset } = get();
        if (status !== 'ready' || mode !== 'demo' || !dataset) return false;
        try {
          const copy = parseRecord(encodeRecord(true, dataset)).dataset;
          const updated = financialDatasetSchema.parse(update(copy));
          return persist(true, updated, set);
        } catch {
          set({ saving: false, error: 'invalid' });
          return false;
        }
      }),
  }));
}
