import { describe, it, expect, vi } from 'vitest';
import { CachingWrapper } from '../../src/index';

describe('CachingWrapper type', () => {
  describe('properties', () => {
    it('should have required properties', () => {
      const wrapper: CachingWrapper<string> = {
        data: 'test data',
        cachedAt: new Date('2024-01-01T10:00:00Z'),
        expiresAt: new Date('2024-01-01T10:05:00Z'),
        isStale: false,
        refresh: vi.fn(),
        invalidate: vi.fn()
      };
      
      expect(wrapper.data).toBe('test data');
      expect(wrapper.cachedAt).toEqual(new Date('2024-01-01T10:00:00Z'));
      expect(wrapper.expiresAt).toEqual(new Date('2024-01-01T10:05:00Z'));
      expect(wrapper.isStale).toBe(false);
      expect(typeof wrapper.refresh).toBe('function');
      expect(typeof wrapper.invalidate).toBe('function');
    });
    
    it('should calculate isStale dynamically', () => {
      const pastDate = new Date(Date.now() - 1000);
      const futureDate = new Date(Date.now() + 1000);
      
      const staleWrapper: CachingWrapper<number> = {
        data: 42,
        cachedAt: pastDate,
        expiresAt: pastDate,
        get isStale() {
          return new Date() > this.expiresAt;
        },
        refresh: vi.fn(),
        invalidate: vi.fn()
      };
      
      const freshWrapper: CachingWrapper<number> = {
        data: 42,
        cachedAt: pastDate,
        expiresAt: futureDate,
        get isStale() {
          return new Date() > this.expiresAt;
        },
        refresh: vi.fn(),
        invalidate: vi.fn()
      };
      
      expect(staleWrapper.isStale).toBe(true);
      expect(freshWrapper.isStale).toBe(false);
    });
  });
  
  describe('refresh() method', () => {
    it('should return a Promise of CachingWrapper', async () => {
      const mockRefresh = vi.fn().mockResolvedValue({
        data: 'new data',
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
        isStale: false,
        refresh: vi.fn(),
        invalidate: vi.fn()
      });
      
      const wrapper: CachingWrapper<string> = {
        data: 'old data',
        cachedAt: new Date(),
        expiresAt: new Date(),
        isStale: true,
        refresh: mockRefresh,
        invalidate: vi.fn()
      };
      
      const result = await wrapper.refresh();
      
      expect(mockRefresh).toHaveBeenCalled();
      expect(result.data).toBe('new data');
      expect(result).toHaveProperty('cachedAt');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('isStale');
      expect(result).toHaveProperty('refresh');
      expect(result).toHaveProperty('invalidate');
    });
    
    it('should handle refresh errors', async () => {
      const mockRefresh = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const wrapper: CachingWrapper<string> = {
        data: 'data',
        cachedAt: new Date(),
        expiresAt: new Date(),
        isStale: false,
        refresh: mockRefresh,
        invalidate: vi.fn()
      };
      
      await expect(wrapper.refresh()).rejects.toThrow('Network error');
    });
  });
  
  describe('invalidate() method', () => {
    it('should be a void function', () => {
      const mockInvalidate = vi.fn();
      
      const wrapper: CachingWrapper<string> = {
        data: 'data',
        cachedAt: new Date(),
        expiresAt: new Date(),
        isStale: false,
        refresh: vi.fn(),
        invalidate: mockInvalidate
      };
      
      wrapper.invalidate();
      
      expect(mockInvalidate).toHaveBeenCalled();
      expect(mockInvalidate).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('type inference', () => {
    it('should preserve generic type T', () => {
      interface User {
        id: number;
        name: string;
      }
      
      const userWrapper: CachingWrapper<User> = {
        data: { id: 1, name: 'John' },
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
        isStale: false,
        refresh: vi.fn(),
        invalidate: vi.fn()
      };
      
      expect(userWrapper.data.id).toBe(1);
      expect(userWrapper.data.name).toBe('John');
      expect(typeof userWrapper.data).toBe('object');
    });
    
    it('should work with primitive types', () => {
      const numberWrapper: CachingWrapper<number> = {
        data: 42,
        cachedAt: new Date(),
        expiresAt: new Date(),
        isStale: false,
        refresh: vi.fn(),
        invalidate: vi.fn()
      };
      
      const stringWrapper: CachingWrapper<string> = {
        data: 'hello',
        cachedAt: new Date(),
        expiresAt: new Date(),
        isStale: false,
        refresh: vi.fn(),
        invalidate: vi.fn()
      };
      
      const booleanWrapper: CachingWrapper<boolean> = {
        data: true,
        cachedAt: new Date(),
        expiresAt: new Date(),
        isStale: false,
        refresh: vi.fn(),
        invalidate: vi.fn()
      };
      
      expect(numberWrapper.data).toBe(42);
      expect(stringWrapper.data).toBe('hello');
      expect(booleanWrapper.data).toBe(true);
    });
    
    it('should work with array types', () => {
      const arrayWrapper: CachingWrapper<string[]> = {
        data: ['a', 'b', 'c'],
        cachedAt: new Date(),
        expiresAt: new Date(),
        isStale: false,
        refresh: vi.fn(),
        invalidate: vi.fn()
      };
      
      expect(arrayWrapper.data).toEqual(['a', 'b', 'c']);
      expect(arrayWrapper.data[0]).toBe('a');
    });
  });
});