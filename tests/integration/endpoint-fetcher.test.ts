import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cache, CachingWrapper } from '../../src/index';

// Mock fetch
global.fetch = vi.fn();

describe('Integration with endpoint-fetcher patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, name: 'Test User' })
    });
  });
  
  it('should demonstrate CachingWrapper type usage', () => {
    const userWrapper: CachingWrapper<{ id: number; name: string }> = {
      data: { id: 1, name: 'John Doe' },
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 300000),
      isStale: false,
      refresh: vi.fn(),
      invalidate: vi.fn()
    };
    
    expect(userWrapper.data.id).toBe(1);
    expect(userWrapper.data.name).toBe('John Doe');
    expect(userWrapper.cachedAt).toBeInstanceOf(Date);
    expect(userWrapper.expiresAt).toBeInstanceOf(Date);
    expect(typeof userWrapper.refresh).toBe('function');
    expect(typeof userWrapper.invalidate).toBe('function');
  });
  
  it('should create cache plugin with configuration', () => {
    const plugin = cache({
      ttl: 600,
      methods: ['GET', 'POST'],
      maxSize: 100
    });
    
    expect(plugin).toBeDefined();
    expect(plugin).toHaveProperty('handlerWrapper');
  });
  
  it('should show how cache plugin would wrap API responses', async () => {
    const plugin = cache({ ttl: 300 });
    const mockHandler = vi.fn().mockResolvedValue({ id: 1, name: 'API User' });
    const wrappedHandler = plugin.handlerWrapper(mockHandler);
    
    const mockContext = {
      method: 'GET',
      path: '/api/users/1',
      baseUrl: 'https://api.example.com',
      fetch: vi.fn()
    };
    
    const result = await wrappedHandler({}, mockContext);
    
    expect(result.data).toEqual({ id: 1, name: 'API User' });
    expect(result).toHaveProperty('cachedAt');
    expect(result).toHaveProperty('expiresAt');
    expect(result).toHaveProperty('isStale');
    expect(result).toHaveProperty('refresh');
    expect(result).toHaveProperty('invalidate');
  });
  
  it('should demonstrate cache behavior simulation', async () => {
    const plugin = cache({ ttl: 1 });
    let callCount = 0;
    const mockHandler = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(`Data ${callCount}`);
    });
    
    const wrappedHandler = plugin.handlerWrapper(mockHandler);
    
    const mockContext = {
      method: 'GET',
      path: '/api/data',
      baseUrl: 'https://api.example.com',
      fetch: vi.fn()
    };
    
    vi.useFakeTimers();
    
    const result1 = await wrappedHandler({}, mockContext);
    expect(result1.data).toBe('Data 1');
    expect(callCount).toBe(1);
    
    const result2 = await wrappedHandler({}, mockContext);
    expect(result2.data).toBe('Data 1');
    expect(callCount).toBe(1);
    
    vi.advanceTimersByTime(2000);
    
    const result3 = await wrappedHandler({}, mockContext);
    expect(result3.data).toBe('Data 2');
    expect(callCount).toBe(2);
    
    vi.useRealTimers();
  });
});