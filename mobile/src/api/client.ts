import { isServerErrorCode } from '@/api/error-codes';
import type { ErrorCode } from '@/api/error-codes';
import { getApiBaseUrl } from '@/config/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type FetchFunction = typeof fetch;
type RefreshHandler = () => Promise<string | null>;

// Enough for the free server to wake up and for grading; after that a spinner would just hang
export const REQUEST_TIMEOUT_MILLISECONDS = 120000;

type RequestOptions = {
  body?: unknown;
  authenticated?: boolean;
  timeoutMilliseconds?: number;
};

/** An HTTP error with an English message, and a code the app shows in the person's language. */
export class ApiError extends Error {
  status: number;
  code: ErrorCode | null;

  constructor(status: number, message: string, code: ErrorCode | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** The error's code from the server's body, or null for an older server or an unknown code. */
export function readErrorCode(status: number, body: unknown): ErrorCode | null {
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const code = (body as { code: unknown }).code;
    if (isServerErrorCode(code)) {
      return code;
    }
  }
  if (status >= 500) {
    return 'server_error';
  }
  return null;
}

/** Turn FastAPI's error body into one readable sentence. */
export function readErrorMessage(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === 'string') {
      return detail;
    }
    // Validation errors arrive as a list; the first one is enough for a form
    if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === 'string') {
      return detail[0].msg;
    }
  }
  if (status >= 500) {
    return 'Something went wrong on our side. Please try again.';
  }
  return 'That request did not work. Please try again.';
}

/** JSON API client that adds the access token and refreshes it once when it expires. */
export class ApiClient {
  private baseUrl: string;
  private fetchFunction: FetchFunction;
  private accessToken: string | null = null;
  private refreshHandler: RefreshHandler | null = null;
  // Shared so several requests failing at once trigger only one refresh
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(baseUrl: string, fetchFunction: FetchFunction = fetch) {
    this.baseUrl = baseUrl;
    this.fetchFunction = fetchFunction;
  }

  /** Set or clear the token sent with authenticated requests. */
  setAccessToken(accessToken: string | null): void {
    this.accessToken = accessToken;
  }

  /** Register how to get a fresh access token when the current one is rejected. */
  setRefreshHandler(refreshHandler: RefreshHandler | null): void {
    this.refreshHandler = refreshHandler;
  }

  /** Send a request and return the parsed JSON body. */
  async request<ResponseBody>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<ResponseBody> {
    const authenticated = options.authenticated ?? true;
    const timeoutMilliseconds = options.timeoutMilliseconds ?? REQUEST_TIMEOUT_MILLISECONDS;
    let response = await this.send(method, path, options.body, authenticated, timeoutMilliseconds);

    if (response.status === 401 && authenticated && this.refreshHandler !== null) {
      const newAccessToken = await this.refreshOnce();
      if (newAccessToken !== null) {
        response = await this.send(method, path, options.body, authenticated, timeoutMilliseconds);
      }
    }

    const responseBody = await this.readJson(response);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        readErrorMessage(response.status, responseBody),
        readErrorCode(response.status, responseBody),
      );
    }
    return responseBody as ResponseBody;
  }

  private async send(
    method: HttpMethod,
    path: string,
    body: unknown,
    authenticated: boolean,
    timeoutMilliseconds: number,
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    // File uploads go as FormData; fetch then sets the multipart Content-Type with its boundary
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) {
      headers['Content-Type'] = 'application/json';
    }
    if (authenticated && this.accessToken !== null) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    // Browsers throw "Illegal invocation" if fetch runs with `this` set to our client
    const fetchFunction = this.fetchFunction;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMilliseconds);
    try {
      return await fetchFunction(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError(
          0,
          'Telmi took too long to answer. Check your connection and try again.',
          'timeout',
        );
      }
      throw new ApiError(0, "Can't reach Telmi. Check your connection and try again.", 'offline');
    } finally {
      clearTimeout(timer);
    }
  }

  private async refreshOnce(): Promise<string | null> {
    if (this.refreshHandler === null) {
      return null;
    }
    if (this.refreshInFlight === null) {
      this.refreshInFlight = this.refreshHandler().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}

export const apiClient = new ApiClient(getApiBaseUrl());
