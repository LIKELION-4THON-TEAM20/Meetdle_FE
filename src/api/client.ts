import type { ApiError, SessionResponse } from './types';

export class ApiRequestError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly details?: ApiError['details'];

  constructor(status: number | null, error: ApiError, options?: ErrorOptions) {
    super(error.message, options);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

type Query = Record<string, string | number | undefined>;
type ReadOptions = { query?: Query; signal?: AbortSignal };
type MutationMethod = 'POST' | 'PUT' | 'DELETE';

function errorBody(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

export function createApiClient(base: string | undefined, fetcher: typeof fetch = fetch) {
  let session: SessionResponse | undefined;
  let pendingSession: Promise<SessionResponse> | undefined;
  let generation = 0;

  function url(path: string, query?: Query) {
    const origin = new URL(base?.trim() ?? '');
    if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) {
      throw new TypeError('Invalid VITE_API_BASE_URL');
    }
    if (!['', '/', '/api', '/api/'].includes(origin.pathname) || origin.search || origin.hash) {
      throw new TypeError('VITE_API_BASE_URL must be an origin or end with /api');
    }
    if (!path.startsWith('/api/')) throw new TypeError('Expected an /api/ path');
    const target = new URL(path, origin.origin);
    if (!target.pathname.startsWith('/api/')) throw new TypeError('Invalid API path');
    for (const [name, value] of Object.entries(query ?? {})) {
      if (value !== undefined) target.searchParams.set(name, String(value));
    }
    return target;
  }

  function clearSession() {
    generation++;
    session = undefined;
    pendingSession = undefined;
  }

  function assertSessionGeneration(start: number) {
    if (start !== generation) {
      throw new ApiRequestError(null, {
        code: 'SESSION_CHANGED',
        message: 'The active session changed while processing the request.',
      });
    }
  }

  async function request<T>(target: URL, init: RequestInit, discardResponse = false): Promise<T> {
    const start = generation;
    let response: Response;
    let body: unknown;
    try {
      response = await fetcher(target, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        redirect: 'error',
      });
      if (response.status === 401 && start === generation) clearSession();
      if (response.status !== 204 && (!response.ok || !discardResponse)) {
        const text = await response.text();
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {
            // HTTP errors can contain plain text, including gateway and CORS responses.
          }
        }
      }
    } catch (cause) {
      if (init.signal?.aborted || (cause instanceof Error && cause.name === 'AbortError')) {
        throw cause;
      }
      throw new ApiRequestError(
        null,
        {
          code: 'NETWORK_ERROR',
          message: 'The request failed before a complete response arrived.',
        },
        { cause },
      );
    }
    if (!response.ok) {
      throw new ApiRequestError(
        response.status,
        errorBody(body)
          ? body
          : { code: `HTTP_${response.status}`, message: `HTTP ${response.status}` },
      );
    }
    assertSessionGeneration(start);
    if (response.status !== 204 && !discardResponse && body === undefined) {
      throw new ApiRequestError(response.status, {
        code: 'INVALID_RESPONSE',
        message: 'Expected a JSON response.',
      });
    }
    return body as T;
  }

  function get<T>(path: string, options: ReadOptions = {}) {
    return request<T>(url(path, options.query), { signal: options.signal });
  }

  function getSession({ refresh = false } = {}): Promise<SessionResponse> {
    if (pendingSession) return pendingSession;
    if (!refresh && session) return Promise.resolve(session);

    const start = generation;
    const pending = get<SessionResponse>('/api/me')
      .then((value) => {
        assertSessionGeneration(start);
        if (!value?.csrfToken || !value.user?.userId) {
          throw new ApiRequestError(200, {
            code: 'INVALID_RESPONSE',
            message: 'Expected an authenticated session and CSRF token.',
          });
        }
        if (
          session &&
          (session.user.userId !== value.user.userId || session.csrfToken !== value.csrfToken)
        ) {
          clearSession();
        }
        session = value;
        return value;
      })
      .finally(() => {
        if (pendingSession === pending) pendingSession = undefined;
      });
    pendingSession = pending;
    return pending;
  }

  function createMutation<T>(
    method: MutationMethod,
    path: string,
    body?: unknown,
    {
      idempotent = false,
      query,
      discardResponse = false,
    }: {
      idempotent?: boolean;
      query?: Query;
      discardResponse?: boolean;
    } = {},
  ) {
    const target = url(path, query);
    const payload = JSON.stringify(body);
    const start = generation;
    const key = idempotent ? crypto.randomUUID() : undefined;
    let pending: Promise<T> | undefined;
    let completed: Promise<T> | undefined;

    function execute(): Promise<T> {
      try {
        assertSessionGeneration(start);
      } catch (error) {
        return Promise.reject(error);
      }
      if (pending) return pending;
      if (completed) return completed;
      pending = (async () => {
        const current = await getSession();
        assertSessionGeneration(start);
        return request<T>(
          target,
          {
            method,
            body: payload,
            headers: {
              'X-CSRF-TOKEN': current.csrfToken,
              ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
              ...(key ? { 'Idempotency-Key': key } : {}),
            },
          },
          discardResponse,
        );
      })()
        .then((value) => {
          completed = Promise.resolve(value);
          return value;
        })
        .finally(() => {
          pending = undefined;
        });
      return pending;
    }

    return {
      execute,
      get pending() {
        return pending !== undefined;
      },
    };
  }

  let pendingLogout: Promise<void> | undefined;
  function logout() {
    if (pendingLogout) return pendingLogout;
    pendingLogout = createMutation<void>('POST', '/api/auth/logout')
      .execute()
      .then(clearSession)
      .finally(() => {
        pendingLogout = undefined;
      });
    return pendingLogout;
  }

  return { url, get, getSession, clearSession, createMutation, logout };
}

export const api = createApiClient(import.meta.env?.VITE_API_BASE_URL);
