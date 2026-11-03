export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

type RequestOptions = { token?: string; method?: string; body?: unknown; idempotencyKey?: string };

export function createApiTransport(baseUrl: () => string, fetcher: typeof fetch = fetch) {
  let recoverSession: ((rejectedToken: string) => Promise<string | null>) | undefined;
  async function request<T>(
    path: string,
    options: RequestOptions = {},
    retried = false,
  ): Promise<T> {
    let root: string;
    try {
      root = baseUrl();
    } catch {
      throw new ApiClientError(-1, 'The API URL configuration is invalid.');
    }
    let response: Response;
    try {
      response = await fetcher(`${root}${path}`, {
        method: options.method ?? 'GET',
        credentials: 'include',
        signal: AbortSignal.timeout(15000),
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
          ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch {
      throw new ApiClientError(0, 'Could not connect to the FinTrack API.');
    }
    const payload: unknown = await response.json().catch(() => null);
    if (response.status === 401 && options.token && !retried && recoverSession) {
      const token = await recoverSession(options.token);
      if (token) return request<T>(path, { ...options, token }, true);
    }
    if (!response.ok) {
      const message =
        response.status < 500 &&
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload &&
        typeof payload.message === 'string' &&
        payload.message.length <= 300
          ? payload.message
          : 'The API could not complete this request.';
      throw new ApiClientError(response.status, message);
    }
    if (payload === null) throw new ApiClientError(502, 'The API returned an invalid response.');
    return payload as T;
  }
  return {
    request,
    setSessionRecovery(handler: (rejectedToken: string) => Promise<string | null>) {
      recoverSession = handler;
    },
  };
}
