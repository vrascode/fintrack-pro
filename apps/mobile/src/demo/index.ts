import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from 'zustand';
import { createDemoStore } from './core';

export const demo = createDemoStore(AsyncStorage);
export const useDemo = () => useStore(demo);

export { DEMO_DATA_KEY, createDemoStore } from './core';
