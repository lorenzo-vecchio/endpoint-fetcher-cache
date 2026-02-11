import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiClient, get, post, group } from 'endpoint-fetcher';
import { cache, CachingWrapper } from '../../src/index';
import type { Mock } from 'vitest';

describe('Integration with endpoint-fetcher', () => {
  let mockFetch: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockResponse = (data: any) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: async () => data,
    text: async () => JSON.stringify(data),
  });

  it('should cache GET responses through createApiClient', async () => {
    const userData = { id: 1, name: 'John' };
    mockFetch.mockResolvedValue(mockResponse(userData));

    const api = createApiClient({
      getUser: get<void, CachingWrapper<{ id: number; name: string }>>('/users/1'),
    }, {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
      plugins: [cache({ ttl: 60 })],
    });

    const result1 = await api.getUser();
    expect(result1.data).toEqual(userData);
    expect(result1.cachedAt).toBeInstanceOf(Date);
    expect(result1.expiresAt).toBeInstanceOf(Date);
    expect(result1.isStale).toBe(false);

    // Second call should use cache
    const result2 = await api.getUser();
    expect(result2.data).toEqual(userData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should expire cache after TTL', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ version: 1 }))
      .mockResolvedValueOnce(mockResponse({ version: 2 }));

    const api = createApiClient({
      getData: get<void, CachingWrapper<{ version: number }>>('/data'),
    }, {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
      plugins: [cache({ ttl: 5 })],
    });

    const result1 = await api.getData();
    expect(result1.data.version).toBe(1);

    // Advance past TTL
    vi.advanceTimersByTime(6000);

    const result2 = await api.getData();
    expect(result2.data.version).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should not cache POST requests by default', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ id: 1 }))
      .mockResolvedValueOnce(mockResponse({ id: 2 }));

    const api = createApiClient({
      createUser: post<{ name: string }, { id: number }>('/users'),
    }, {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
      plugins: [cache({ ttl: 60 })],
    });

    const result1 = await api.createUser({ name: 'Alice' });
    const result2 = await api.createUser({ name: 'Bob' });

    // POST bypasses cache, returns raw data (no wrapper)
    expect(result1).toEqual({ id: 1 });
    expect(result2).toEqual({ id: 2 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should cache POST requests when configured', async () => {
    mockFetch.mockResolvedValue(mockResponse({ results: [1, 2, 3] }));

    const api = createApiClient({
      search: post<{ q: string }, CachingWrapper<{ results: number[] }>>('/search'),
    }, {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
      plugins: [cache({ ttl: 60, methods: ['GET', 'POST'] })],
    });

    await api.search({ q: 'test' });
    await api.search({ q: 'test' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should work with grouped endpoints', async () => {
    const usersData = [{ id: 1, name: 'Alice' }];
    mockFetch.mockResolvedValue(mockResponse(usersData));

    const api = createApiClient({
      users: group({
        endpoints: {
          getAll: get<void, CachingWrapper<{ id: number; name: string }[]>>('/users'),
        },
      }),
    }, {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
      plugins: [cache({ ttl: 60 })],
    });

    const result = await api.users.getAll();
    expect(result.data).toEqual(usersData);

    // Cached
    await api.users.getAll();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should support refresh() to force re-fetch', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ v: 1 }))
      .mockResolvedValueOnce(mockResponse({ v: 2 }));

    const api = createApiClient({
      getData: get<void, CachingWrapper<{ v: number }>>('/data'),
    }, {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
      plugins: [cache({ ttl: 300 })],
    });

    const result = await api.getData();
    expect(result.data.v).toBe(1);

    const refreshed = await result.refresh();
    expect(refreshed.data.v).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should support invalidate() to remove from cache', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ v: 1 }))
      .mockResolvedValueOnce(mockResponse({ v: 2 }));

    const api = createApiClient({
      getData: get<void, CachingWrapper<{ v: number }>>('/data'),
    }, {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
      plugins: [cache({ ttl: 300 })],
    });

    const result = await api.getData();
    expect(result.data.v).toBe(1);

    result.invalidate();

    const result2 = await api.getData();
    expect(result2.data.v).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should report isStale correctly after TTL expires', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: true }));

    const api = createApiClient({
      getData: get<void, CachingWrapper<{ ok: boolean }>>('/data'),
    }, {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
      plugins: [cache({ ttl: 5 })],
    });

    const result = await api.getData();
    expect(result.isStale).toBe(false);

    vi.advanceTimersByTime(6000);
    expect(result.isStale).toBe(true);
  });

  it('should cache different inputs separately', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ id: 1, name: 'Alice' }))
      .mockResolvedValueOnce(mockResponse({ id: 2, name: 'Bob' }));

    const api = createApiClient({
      getUser: get<{ id: number }, CachingWrapper<{ id: number; name: string }>>(
        (input) => `/users/${input.id}`
      ),
    }, {
      baseUrl: 'https://api.example.com',
      fetch: mockFetch,
      plugins: [cache({ ttl: 60 })],
    });

    const alice = await api.getUser({ id: 1 });
    const bob = await api.getUser({ id: 2 });

    expect(alice.data.name).toBe('Alice');
    expect(bob.data.name).toBe('Bob');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Same input should use cache
    await api.getUser({ id: 1 });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  describe('plugin methods via client.plugins.cache', () => {
    it('should expose clear method', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ v: 1 }))
        .mockResolvedValueOnce(mockResponse({ v: 2 }));

      const api = createApiClient({
        getData: get<void, CachingWrapper<{ v: number }>>('/data'),
      }, {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [cache({ ttl: 300 })] as const,
      });

      await api.getData();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      api.plugins.cache.clear();

      await api.getData();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should expose invalidate method', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ v: 1 }))
        .mockResolvedValueOnce(mockResponse({ v: 2 }));

      const api = createApiClient({
        getData: get<void, CachingWrapper<{ v: number }>>('/data'),
      }, {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [cache({ ttl: 300 })] as const,
      });

      await api.getData();

      api.plugins.cache.invalidate('GET', '/data', undefined);

      await api.getData();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should expose invalidateKey method', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ v: 1 }))
        .mockResolvedValueOnce(mockResponse({ v: 2 }));

      const api = createApiClient({
        getData: get<void, CachingWrapper<{ v: number }>>('/data'),
      }, {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [cache({ ttl: 300 })] as const,
      });

      await api.getData();

      api.plugins.cache.invalidateKey('GET:/data:');

      await api.getData();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clear only specific entries while keeping others', async () => {
      mockFetch
        .mockResolvedValueOnce(mockResponse({ name: 'Alice' }))
        .mockResolvedValueOnce(mockResponse({ items: ['a'] }))
        .mockResolvedValueOnce(mockResponse({ name: 'Alice v2' }));

      const api = createApiClient({
        getUser: get<void, CachingWrapper<{ name: string }>>('/user'),
        getItems: get<void, CachingWrapper<{ items: string[] }>>('/items'),
      }, {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [cache({ ttl: 300 })] as const,
      });

      await api.getUser();
      await api.getItems();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Invalidate only /user
      api.plugins.cache.invalidate('GET', '/user', undefined);

      await api.getUser();  // re-fetches
      await api.getItems(); // still cached
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when maxSize is reached', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        const id = url.split('/').pop();
        return mockResponse({ id });
      });

      const api = createApiClient({
        getUser: get<{ id: number }, CachingWrapper<{ id: string }>>(
          (input) => `/users/${input.id}`
        ),
      }, {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [cache({ ttl: 300, maxSize: 2 })],
      });

      await api.getUser({ id: 1 });
      await api.getUser({ id: 2 });
      await api.getUser({ id: 3 }); // should evict id=1

      mockFetch.mockClear();

      // id=1 should be evicted, needs re-fetch
      await api.getUser({ id: 1 });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      mockFetch.mockClear();

      // id=3 should still be cached
      await api.getUser({ id: 3 });
      expect(mockFetch).toHaveBeenCalledTimes(0);
    });
  });

  describe('custom key generator', () => {
    it('should use custom key generator for cache keys', async () => {
      mockFetch.mockResolvedValue(mockResponse({ data: 'test' }));

      const api = createApiClient({
        getData: get<{ version: number }, CachingWrapper<{ data: string }>>(
          (input) => `/data?v=${input.version}`
        ),
      }, {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [cache({
          ttl: 300,
          keyGenerator: (method, path) => `${method}:${path}`,
        })],
      });

      await api.getData({ version: 1 });
      await api.getData({ version: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom storage', () => {
    it('should use custom storage backend', async () => {
      const entries = new Map<string, any>();
      const customStorage = {
        get: (key: string) => entries.get(key),
        set: (key: string, value: any) => { entries.set(key, value); },
        delete: (key: string) => { entries.delete(key); },
        clear: () => { entries.clear(); },
        keys: () => Array.from(entries.keys()),
      };

      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const api = createApiClient({
        getData: get<void, CachingWrapper<{ ok: boolean }>>('/data'),
      }, {
        baseUrl: 'https://api.example.com',
        fetch: mockFetch,
        plugins: [cache({ ttl: 60, storage: customStorage })],
      });

      await api.getData();

      expect(entries.size).toBe(1);
      expect(entries.has('GET:/data:')).toBe(true);
    });
  });
});
