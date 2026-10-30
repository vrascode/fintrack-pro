import { createStore, type StoreApi } from 'zustand/vanilla';
import { clientSessionSchema, loginSchema, type ClientSession, type Login } from '@fintrack/shared';

export interface SessionStorage {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthApi {
  restore?(): Promise<ClientSession | null>;
  login(input: Login): Promise<ClientSession>;
  register(input: { email: string; password: string }): Promise<unknown>;
  logout(token: string): Promise<unknown>;
}

export interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated';
  session: ClientSession | null;
  error: 'read' | 'invalid' | 'network' | 'credentials' | 'exists' | null;
  hydrate(): Promise<void>;
  signIn(input: Login): Promise<boolean>;
  register(input: { email: string; password: string }, deviceName: string): Promise<boolean>;
  signOut(): Promise<void>;
}

function loginError(error: unknown): AuthState['error'] {
  if (typeof error !== 'object' || error === null || !('status' in error)) return 'network';
  if (error.status === 401) return 'credentials';
  if (error.status === 409) return 'exists';
  if (error.status === 400) return 'invalid';
  return 'network';
}

export function createAuthStore(storage: SessionStorage, api: AuthApi): StoreApi<AuthState> {
  let hydrating = false;
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
        const session = clientSessionSchema.parse(JSON.parse(stored));
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
          error = 'network';
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
