import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';
import { createPreferences } from './core';

export const preferences = createPreferences(AsyncStorage);
export const usePreferences = () => useStore(preferences);
