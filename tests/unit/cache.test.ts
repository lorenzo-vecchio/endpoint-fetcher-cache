import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cache, clearCache } from '../../src/index';

describe('cache() plugin function', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create plugin with required properties', () => {
    const plugin = cache();
    expect(plugin).toHaveProperty('name', 'cache');
    expect(plugin).toHaveProperty('handlerWrapper');
    expect(plugin).toHaveProperty('methods');
    expect(typeof plugin.handlerWrapper).toBe('function');
  });

  it('should expose methods: clear, invalidate, invalidateKey', () => {
    const plugin = cache();
    expect(typeof plugin.methods!.clear).toBe('function');
    expect(typeof plugin.methods!.invalidate).toBe('function');
    expect(typeof plugin.methods!.invalidateKey).toBe('function');
  });

  it('should accept configuration options', () => {
    const plugin = cache({
      ttl: 600,
      methods: ['GET', 'POST'],
      maxSize: 50,
    });
    expect(plugin).toBeDefined();
    expect(plugin.name).toBe('cache');
  });

  it('should create wrapper with cache metadata', async () => {
    const plugin = cache({ ttl: 300 });
    const mockHandler = vi.fn().mockResolvedValue('test-data');
    const wrappedHandler = plugin.handlerWrapper!(mockHandler, {} as any);

    const mockContext = {
      method: 'GET' as const,
      path: '/api/test',
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(),
    };

    const result = await wrappedHandler({}, mockContext);

    expect(result).toHaveProperty('data', 'test-data');
    expect(result).toHaveProperty('cachedAt');
    expect(result).toHaveProperty('expiresAt');
    expect(result).toHaveProperty('isStale');
    expect(result).toHaveProperty('refresh');
    expect(result).toHaveProperty('invalidate');

    expect(result.cachedAt).toBeInstanceOf(Date);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt.getTime() - result.cachedAt.getTime()).toBe(300000);
  });

  it('should cache GET requests by default', async () => {
    const plugin = cache();
    const mockHandler = vi.fn().mockResolvedValue('data');
    const wrappedHandler = plugin.handlerWrapper!(mockHandler, {} as any);

    const mockContext = {
      method: 'GET' as const,
      path: '/api/test',
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(),
    };

    await wrappedHandler({}, mockContext);
    await wrappedHandler({}, mockContext);

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should not cache POST requests by default', async () => {
    const plugin = cache();
    const mockHandler = vi.fn().mockResolvedValue('data');
    const wrappedHandler = plugin.handlerWrapper!(mockHandler, {} as any);

    const mockContext = {
      method: 'POST' as const,
      path: '/api/test',
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(),
    };

    const result = await wrappedHandler({}, mockContext);

    expect(result).toBe('data');
    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should respect TTL expiration', async () => {
    const plugin = cache({ ttl: 1 });
    const mockHandler = vi.fn()
      .mockResolvedValueOnce('old-data')
      .mockResolvedValueOnce('new-data');
    const wrappedHandler = plugin.handlerWrapper!(mockHandler, {} as any);

    const mockContext = {
      method: 'GET' as const,
      path: '/api/test',
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(),
    };

    const result1 = await wrappedHandler({}, mockContext);
    expect(result1.data).toBe('old-data');

    vi.advanceTimersByTime(2000);

    const result2 = await wrappedHandler({}, mockContext);
    expect(result2.data).toBe('new-data');
    expect(mockHandler).toHaveBeenCalledTimes(2);
  });

  it('should use default TTL of 300 seconds', async () => {
    const plugin = cache();
    const mockHandler = vi.fn().mockResolvedValue('data');
    const wrappedHandler = plugin.handlerWrapper!(mockHandler, {} as any);

    const mockContext = {
      method: 'GET' as const,
      path: '/test',
      baseUrl: 'https://api.example.com',
      fetch: vi.fn(),
    };

    const result = await wrappedHandler({}, mockContext);
    expect(result.expiresAt.getTime() - result.cachedAt.getTime()).toBe(300000);
  });
});

describe('clearCache() function', () => {
  it('should clear provided storage', () => {
    const customStorage = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      keys: vi.fn(),
    };

    clearCache(customStorage);

    expect(customStorage.clear).toHaveBeenCalled();
  });

  it('should not throw when called without storage', () => {
    expect(() => clearCache()).not.toThrow();
  });
});
