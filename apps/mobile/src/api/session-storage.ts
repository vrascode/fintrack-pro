// Web keeps access credentials in memory; reload restores through the HttpOnly cookie.
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
