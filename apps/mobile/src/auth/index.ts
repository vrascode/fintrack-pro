import { useStore } from 'zustand';
import { apiClient } from '../api/client';
import { sessionStorage } from '../api/session-storage';
import { createAuthStore, type AuthState } from './core';

export const auth = createAuthStore(sessionStorage, apiClient);
export function useAuth(): AuthState;
export function useAuth<T>(selector: (state: AuthState) => T): T;
export function useAuth<T>(selector?: (state: AuthState) => T) {
  return selector ? useStore(auth, selector) : useStore(auth);
}

export { createAuthStore } from './core';
