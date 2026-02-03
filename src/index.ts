import { createPlugin } from 'endpoint-fetcher';
import type { PluginOptions } from 'endpoint-fetcher';

/**
 * Wrapper type that adds caching metadata and methods to the response
 * 
 * @template T - The actual data type being cached
 * 
 * @example
 * ```typescript
 * const api = createApiClient({
 *   users: {
 *     endpoints: {
 *       getAll: get<void, CachingWrapper<User[]>>('/users')
 *     }
 *   }
 * }, {
 *   baseUrl: 'https://api.example.com',
 *   plugins: [cache({ ttl: 300 })]
 * });
 * 
 * const result = await api.users.getAll();
 * console.log(result.data);        // User[]
 * console.log(result.cachedAt);    // Date
 * console.log(result.isStale);     // boolean
 * await result.refresh();          // Refresh the cache
 * result.invalidate();             // Clear from cache
 * ```
 */
export type CachingWrapper<T> = {
  /**
   * The actual cached data
   */
  data: T;
  
  /**
   * When this data was cached
   */
  cachedAt: Date;
  
  /**
   * When this cache entry will expire
   */
  expiresAt: Date;
  
  /**
   * Whether this cache entry has expired
   */
  isStale: boolean;
  
  /**
   * Refresh the data by fetching it again and updating the cache
   */
  refresh: () => Promise<CachingWrapper<T>>;
  
  /**
   * Remove this entry from the cache
   */
  invalidate: () => void;
};

/**
 * Configuration options for the caching plugin
 */
export type CachePluginConfig = {
  /**
   * Time to live in seconds - how long cached data remains valid
   * @default 300 (5 minutes)
   */
  ttl?: number;
  
  /**
   * HTTP methods to cache
   * @default ['GET']
   */
  methods?: string[];
  
  /**
   * Maximum number of cache entries to store
   * When exceeded, oldest entries are removed (LRU)
   * @default Infinity (no limit)
   */
  maxSize?: number;
  
  /**
   * Custom cache key generator
   * By default uses: `${method}:${path}:${JSON.stringify(input)}`
   * 
   * @param method - HTTP method
   * @param path - Request path
   * @param input - Request input/body
   * @returns Cache key string
   */
  keyGenerator?: (method: string, path: string, input: any) => string;
  
  /**
   * Custom storage adapter (useful for persistent caching)
   * @default In-memory Map
   */
  storage?: CacheStorage;
};

/**
 * Cache storage interface
 */
export interface CacheStorage {
  get(key: string): CacheEntry | undefined;
  set(key: string, value: CacheEntry): void;
  delete(key: string): void;
  clear(): void;
  keys(): string[];
}

/**
 * Cache entry structure
 */
export interface CacheEntry {
  data: any;
  cachedAt: Date;
  expiresAt: Date;
}

/**
 * Default in-memory cache storage with LRU eviction
 */
class InMemoryCacheStorage implements CacheStorage {
  private cache = new Map<string, CacheEntry>();
  private accessOrder: string[] = [];
  
  constructor(private maxSize: number = Infinity) {}
  
  get(key: string): CacheEntry | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      // Update access order (LRU)
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    }
    return entry;
  }
  
  set(key: string, value: CacheEntry): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    this.cache.set(key, value);
    
    // Update access order
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
  }
  
  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter(k => k !== key);
  }
  
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }
  
  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

/**
 * Default cache key generator
 */
const defaultKeyGenerator = (method: string, path: string, input: any): string => {
  const inputStr = input === undefined || input === null 
    ? '' 
    : JSON.stringify(input);
  return `${method}:${path}:${inputStr}`;
};

/**
 * Caching plugin for endpoint-fetcher
 * 
 * Wraps API responses with caching metadata and methods, allowing you to:
 * - Cache responses in memory
 * - Check cache freshness
 * - Manually refresh cached data
 * - Invalidate specific cache entries
 * 
 * @param config - Plugin configuration
 * @returns Plugin options for endpoint-fetcher
 * 
 * @example
 * Basic usage:
 * ```typescript
 * import { createApiClient, get } from 'endpoint-fetcher';
 * import { cache, CachingWrapper } from 'endpoint-fetcher-cache';
 * 
 * const api = createApiClient({
 *   users: {
 *     endpoints: {
 *       // Output type must be CachingWrapper<T>
 *       getAll: get<void, CachingWrapper<User[]>>('/users'),
 *       getById: get<{ id: string }, CachingWrapper<User>>((input) => `/users/${input.id}`)
 *     }
 *   }
 * }, {
 *   baseUrl: 'https://api.example.com',
 *   plugins: [
 *     cache({ ttl: 300 }) // Cache for 5 minutes
 *   ]
 * });
 * 
 * const result = await api.users.getAll();
 * console.log(result.data);        // User[]
 * console.log(result.cachedAt);    // Date
 * console.log(result.isStale);     // boolean
 * await result.refresh();          // Force refresh
 * result.invalidate();             // Clear from cache
 * ```
 * 
 * @example
 * Advanced usage with custom storage:
 * ```typescript
 * import { cache } from 'endpoint-fetcher-cache';
 * 
 * const api = createApiClient({
 *   // ... endpoints
 * }, {
 *   baseUrl: 'https://api.example.com',
 *   plugins: [
 *     cache({
 *       ttl: 600,                    // 10 minutes
 *       methods: ['GET', 'POST'],    // Cache GET and POST
 *       maxSize: 100,                // Store max 100 entries
 *       keyGenerator: (method, path, input) => {
 *         // Custom key generation
 *         return `custom:${method}:${path}`;
 *       }
 *     })
 *   ]
 * });
 * ```
 */
export const cache = createPlugin((config: CachePluginConfig = {}): PluginOptions => {
  const {
    ttl = 300,
    methods = ['GET'],
    maxSize = Infinity,
    keyGenerator = defaultKeyGenerator,
    storage = new InMemoryCacheStorage(maxSize)
  } = config;
  
  return {
    handlerWrapper: <TInput, TOutput, TError>(
      originalHandler: (
        input: TInput,
        context: {
          fetch: typeof fetch;
          method: any;
          path: string;
          baseUrl: string;
        }
      ) => Promise<TOutput>
    ) => {
      return async (input: TInput, context) => {
        // Only cache specified methods
        if (!methods.includes(context.method)) {
          return originalHandler(input, context);
        }
        
        const cacheKey = keyGenerator(context.method, context.path, input);
        
        // Extract the inner type from CachingWrapper<T>
        type InnerType = TOutput extends CachingWrapper<infer U> ? U : TOutput;
        
        // Helper to create the wrapper
        const createWrapper = (
          data: InnerType,
          cachedAt: Date,
          expiresAt: Date
        ): TOutput => {
          const wrapper = {
            data,
            cachedAt,
            expiresAt,
            get isStale() {
              return new Date() > expiresAt;
            },
            refresh: async () => {
              storage.delete(cacheKey);
              const freshData = await originalHandler(input, context) as unknown as InnerType;
              const newCachedAt = new Date();
              const newExpiresAt = new Date(newCachedAt.getTime() + ttl * 1000);
              
              storage.set(cacheKey, {
                data: freshData,
                cachedAt: newCachedAt,
                expiresAt: newExpiresAt
              });
              
              return createWrapper(freshData, newCachedAt, newExpiresAt);
            },
            invalidate: () => {
              storage.delete(cacheKey);
            }
          } as CachingWrapper<InnerType>;
          
          return wrapper as TOutput;
        };
        
        // Check cache
        const cached = storage.get(cacheKey);
        const now = new Date();
        
        if (cached && now < cached.expiresAt) {
          return createWrapper(cached.data, cached.cachedAt, cached.expiresAt);
        }
        
        // Fetch fresh data
        // originalHandler returns TOutput, but the API actually returns InnerType
        const result = await originalHandler(input, context) as unknown as InnerType;
        const cachedAt = new Date();
        const expiresAt = new Date(cachedAt.getTime() + ttl * 1000);
        
        storage.set(cacheKey, {
          data: result,
          cachedAt,
          expiresAt
        });
        
        return createWrapper(result, cachedAt, expiresAt);
      };
    }
  };
});

/**
 * Clears all cache entries
 * 
 * @example
 * ```typescript
 * import { clearCache } from 'endpoint-fetcher-cache';
 * 
 * clearCache(); // Clears all cached data
 * ```
 */
export const clearCache = (storage?: CacheStorage) => {
  if (storage) {
    storage.clear();
  }
};

// Default export
export default cache;