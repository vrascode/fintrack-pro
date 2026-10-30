import { createStore, type StoreApi } from 'zustand/vanilla';
import { authSessionSchema, loginSchema, type AuthSession, type Login } from '@fintrack/shared';

export interface SessionStorage {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthApi {
  login(input: Login): Promise<AuthSession>;
  register(input: { email: string; password: string }): Promise<unknown>;
  logout(token: string): Promise<unknown>;
}

export interface AuthState {
  status: 'loading' | 'anonymous' | 'authenticated';
  session: AuthSession | null;
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
  return createStore<AuthState>((set, get) => ({
    status: 'loading',
    session: null,
    error: null,
    async hydrate() {
      try {
        const stored = await storage.get();
        if (!stored) {
          set({ status: 'anonymous', session: null, error: null });
          return;
        }
        const session = authSessionSchema.parse(JSON.parse(stored));
        set({ status: 'authenticated', session, error: null });
      } catch {
        try {
          await storage.clear();
        } catch {
          set({ status: 'anonymous', session: null, error: 'read' });
          return;
        }
        set({ status: 'anonymous', session: null, error: 'invalid' });
      }
    },
    async signIn(input) {
      set({ status: 'loading', error: null });
      try {
        const session = authSessionSchema.parse(await api.login(loginSchema.parse(input)));
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
      set({ status: 'loading', error: null });
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
