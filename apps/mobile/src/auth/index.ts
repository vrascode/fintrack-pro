import { useStore } from 'zustand';
import { apiClient } from '../api/client';
import { sessionStorage } from '../api/session-storage';
import { createAuthStore } from './core';

export const auth = createAuthStore(sessionStorage, apiClient);
export const useAuth = () => useStore(auth);

export { createAuthStore } from './core';
