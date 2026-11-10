import { ApiClient, ApiError, readErrorMessage } from '@/api/client';

type FakeResponse = { status: number; body: unknown };

/** A fetch stand-in that answers with queued responses and records each call. */
function createFakeFetch(responses: FakeResponse[]) {
  const fakeFetch = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const next = responses.shift();
    if (next === undefined) {
      throw new Error('No fake response queued');
    }
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
    } as Response;
  });
  return fakeFetch;
}

function sentHeaders(
  fakeFetch: ReturnType<typeof createFakeFetch>,
  callIndex: number,
): Record<string, string> {
  return fakeFetch.mock.calls[callIndex][1]?.headers as Record<string, string>;
}

describe('ApiClient', () => {
  it('sends JSON with the access token', async () => {
    const fakeFetch = createFakeFetch([{ status: 200, body: { ok: true } }]);
    const client = new ApiClient('https://api.test', fakeFetch);
    client.setAccessToken('access-1');

    const body = await client.request('POST', '/things', { body: { name: 'x' } });

    expect(body).toEqual({ ok: true });
    expect(fakeFetch.mock.calls[0][0]).toBe('https://api.test/things');
    expect(sentHeaders(fakeFetch, 0).Authorization).toBe('Bearer access-1');
    expect(sentHeaders(fakeFetch, 0)['Content-Type']).toBe('application/json');
  });

  it('sends files as FormData and lets fetch set the multipart type', async () => {
    const fakeFetch = createFakeFetch([
      { status: 401, body: { detail: 'Session expired or invalid' } },
      { status: 200, body: { text: 'Notes', truncated: false } },
    ]);
    const client = new ApiClient('https://api.test', fakeFetch);
    client.setRefreshHandler(async () => {
      client.setAccessToken('new-token');
      return 'new-token';
    });
    const form = new FormData();
    form.append('file', 'notes');

    await client.request('POST', '/classrooms/class-1/material-text', { body: form });

    // The same form is sent again after the token refresh
    expect(fakeFetch.mock.calls[1][1]?.body).toBe(form);
    expect(sentHeaders(fakeFetch, 1)['Content-Type']).toBeUndefined();
    expect(sentHeaders(fakeFetch, 1).Authorization).toBe('Bearer new-token');
  });

  it('leaves out the token for unauthenticated requests', async () => {
    const fakeFetch = createFakeFetch([{ status: 200, body: {} }]);
    const client = new ApiClient('https://api.test', fakeFetch);
    client.setAccessToken('access-1');

    await client.request('POST', '/auth/login', { authenticated: false });

    expect(sentHeaders(fakeFetch, 0).Authorization).toBeUndefined();
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    const fakeFetch = createFakeFetch([
      { status: 401, body: { detail: 'Session expired or invalid' } },
      { status: 200, body: { ok: true } },
    ]);
    const client = new ApiClient('https://api.test', fakeFetch);
    client.setAccessToken('old-token');
    client.setRefreshHandler(async () => {
      client.setAccessToken('new-token');
      return 'new-token';
    });

    const body = await client.request('GET', '/me');

    expect(body).toEqual({ ok: true });
    expect(sentHeaders(fakeFetch, 1).Authorization).toBe('Bearer new-token');
  });

  it('shares one refresh between requests that fail at the same time', async () => {
    const fakeFetch = createFakeFetch([
      { status: 401, body: {} },
      { status: 401, body: {} },
      { status: 200, body: { first: true } },
      { status: 200, body: { second: true } },
    ]);
    const client = new ApiClient('https://api.test', fakeFetch);
    const refreshHandler = jest.fn(async () => 'new-token');
    client.setRefreshHandler(refreshHandler);

    await Promise.all([client.request('GET', '/a'), client.request('GET', '/b')]);

    expect(refreshHandler).toHaveBeenCalledTimes(1);
  });

  it('gives up with the 401 when the refresh fails', async () => {
    const fakeFetch = createFakeFetch([{ status: 401, body: { detail: 'Not signed in' } }]);
    const client = new ApiClient('https://api.test', fakeFetch);
    client.setRefreshHandler(async () => null);

    await expect(client.request('GET', '/me')).rejects.toEqual(new ApiError(401, 'Not signed in'));
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it('calls fetch without binding it to the client, like browsers require', async () => {
    // Mimics the browser: native fetch throws when called as a method of another object
    const browserLikeFetch = async function (this: unknown) {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    };
    const client = new ApiClient('https://api.test', browserLikeFetch as typeof fetch);

    await expect(client.request('GET', '/health')).resolves.toEqual({ ok: true });
  });

  it('reports network failures as a friendly error', async () => {
    const failingFetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const client = new ApiClient('https://api.test', failingFetch);

    await expect(client.request('GET', '/me')).rejects.toMatchObject({ status: 0 });
  });
});

describe('readErrorMessage', () => {
  it('uses a plain detail string', () => {
    expect(readErrorMessage(409, { detail: 'That username is already taken' })).toBe(
      'That username is already taken',
    );
  });

  it('uses the first validation message', () => {
    const body = { detail: [{ msg: 'String should have at least 8 characters' }] };
    expect(readErrorMessage(422, body)).toBe('String should have at least 8 characters');
  });

  it('falls back to a generic message for server errors', () => {
    expect(readErrorMessage(500, null)).toContain('Something went wrong');
  });
});
