import { createStore, type StoreApi } from 'zustand/vanilla';
import { clientSessionSchema, loginSchema, type ClientSession, type Login } from '@fintrack/shared';

export interface SessionStorage {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthApi {
  restore?(): Promise<ClientSession | null>;
  refresh?(session: ClientSession): Promise<ClientSession>;
  login(input: Login): Promise<ClientSession>;
  register(input: { email: string; password: string }): Promise<unknown>;
  logout(token: string): Promise<unknown>;
}

export interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated';
  session: ClientSession | null;
  error:
    | 'read'
    | 'invalid'
    | 'network'
    | 'credentials'
    | 'exists'
    | 'unavailable'
    | 'rate'
    | 'configuration'
    | 'origin'
    | 'server'
    | null;
  hydrate(): Promise<void>;
  renew(): Promise<string | null>;
  signIn(input: Login): Promise<boolean>;
  register(input: { email: string; password: string }, deviceName: string): Promise<boolean>;
  signOut(): Promise<void>;
}

function loginError(error: unknown): AuthState['error'] {
  if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ZodError')
    return 'invalid';
  if (typeof error !== 'object' || error === null || !('status' in error)) return 'server';
  if (error.status === -1) return 'configuration';
  if (error.status === 0) return 'network';
  if (error.status === 401) return 'credentials';
  if (error.status === 409) return 'exists';
  if (error.status === 400) return 'invalid';
  if (error.status === 403) return 'origin';
  if (error.status === 503) return 'unavailable';
  if (error.status === 429) return 'rate';
  return 'server';
}

export function createAuthStore(storage: SessionStorage, api: AuthApi): StoreApi<AuthState> {
  let hydrating = false;
  let renewing: Promise<string | null> | null = null;
  return createStore<AuthState>((set, get) => ({
    status: 'loading',
    session: null,
    error: null,
    async hydrate() {
      if (hydrating) return;
      hydrating = true;
      try {
        const stored = await storage.get();
        if (!stored) {
          try {
            const restored = await api.restore?.();
            if (restored) {
              await storage.set(JSON.stringify(restored));
              set({
                status: 'authenticated',
                session: clientSessionSchema.parse(restored),
                error: null,
              });
              return;
            }
          } catch {
            set({ status: 'anonymous', session: null, error: 'network' });
            return;
          }
          set({ status: 'anonymous', session: null, error: null });
          return;
        }
        let session = clientSessionSchema.parse(JSON.parse(stored));
        if (api.refresh) session = clientSessionSchema.parse(await api.refresh(session));
        if (Date.parse(session.expiresAt) <= Date.now()) throw new Error('Expired session');
        await storage.set(JSON.stringify(session));
        set({ status: 'authenticated', session, error: null });
      } catch {
        try {
          await storage.clear();
        } catch {
          set({ status: 'anonymous', session: null, error: 'read' });
          return;
        }
        set({ status: 'anonymous', session: null, error: 'invalid' });
      } finally {
        hydrating = false;
      }
    },
    renew() {
      if (renewing) return renewing;
      renewing = (async () => {
        const previous = get().session;
        if (!previous || !api.refresh) return null;
        try {
          const session = clientSessionSchema.parse(await api.refresh(previous));
          // A refresh finishing after logout must not restore a revoked session.
          if (get().session !== previous) return null;
          await storage.set(JSON.stringify(session));
          set({ session, status: 'authenticated', error: null });
          return session.accessToken;
        } catch (error) {
          if (get().session !== previous) return null;
          if (
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            error.status === 401
          ) {
            let failure: AuthState['error'] = 'credentials';
            try {
              await storage.clear();
            } catch {
              failure = 'read';
            }
            if (get().session === previous) {
              set({ status: 'anonymous', session: null, error: failure });
            }
          }
          return null;
        }
      })().finally(() => {
        renewing = null;
      });
      return renewing;
    },
    async signIn(input) {
      set({ error: null });
      try {
        const session = clientSessionSchema.parse(await api.login(loginSchema.parse(input)));
        await storage.set(JSON.stringify(session));
        set({ status: 'authenticated', session, error: null });
        return true;
      } catch (error) {
        set({
          status: 'anonymous',
          session: null,
          error: loginError(error),
        });
        return false;
      }
    },
    async register(input, deviceName) {
      set({ error: null });
      try {
        await api.register(input);
      } catch (error) {
        set({ status: 'anonymous', session: null, error: loginError(error) });
        return false;
      }
      return get().signIn({ ...input, deviceName });
    },
    async signOut() {
      const session = get().session;
      let error: AuthState['error'] = null;
      if (session) {
        try {
          await api.logout(session.accessToken);
        } catch {
          set({ error: 'network' });
          return;
        }
      }
      try {
        await storage.clear();
      } catch {
        error = 'read';
      }
      set({ status: 'anonymous', session: null, error });
    },
  }));
}
