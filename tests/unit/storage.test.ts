import { describe, it, expect, vi } from 'vitest';
import { CacheStorage, CacheEntry } from '../../src/index';

describe('CacheStorage interface', () => {
  it('should enforce correct method signatures', () => {
    const mockStorage: CacheStorage = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      keys: vi.fn()
    };
    
    expect(typeof mockStorage.get).toBe('function');
    expect(typeof mockStorage.set).toBe('function');
    expect(typeof mockStorage.delete).toBe('function');
    expect(typeof mockStorage.clear).toBe('function');
    expect(typeof mockStorage.keys).toBe('function');
  });
  
  it('should allow custom storage implementations', () => {
    const entries = new Map<string, CacheEntry>();
    
    const customStorage: CacheStorage = {
      get: (key: string) => entries.get(key),
      set: (key: string, value: CacheEntry) => {
        entries.set(key, value);
      },
      delete: (key: string) => {
        entries.delete(key);
      },
      clear: () => {
        entries.clear();
      },
      keys: () => Array.from(entries.keys())
    };
    
    const entry: CacheEntry = {
      data: 'test',
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000)
    };
    
    customStorage.set('test-key', entry);
    expect(customStorage.get('test-key')).toEqual(entry);
    expect(customStorage.keys()).toEqual(['test-key']);
    
    customStorage.delete('test-key');
    expect(customStorage.get('test-key')).toBeUndefined();
    
    customStorage.set('key1', entry);
    customStorage.set('key2', entry);
    expect(customStorage.keys().length).toBe(2);
    
    customStorage.clear();
    expect(customStorage.keys().length).toBe(0);
  });
});