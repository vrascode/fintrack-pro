// Web keeps credentials in memory only; reloads require signing in again.
let session: string | null = null;

export const sessionStorage = {
  get: async () => session,
  set: async (value: string) => {
    session = value;
  },
  clear: async () => {
    session = null;
  },
};
