import * as SecureStore from 'expo-secure-store';

const key = 'fintrack.auth.session.v1';

export const sessionStorage = {
  get: () => SecureStore.getItemAsync(key),
  set: (value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clear: () => SecureStore.deleteItemAsync(key),
};
