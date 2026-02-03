# endpoint-fetcher-cache

A caching plugin for [endpoint-fetcher](https://github.com/lorenzo-vecchio/endpoint-fetcher) that adds intelligent caching with type-safe wrapper support.

## Features

* 🔒 **Fully Type-Safe** - TypeScript support with complete type inference
* ⚡ **Smart Caching** - Automatic caching with TTL support
* 🔄 **Manual Refresh** - Programmatically refresh cached data
* 🗑️ **Cache Invalidation** - Clear specific cache entries
* 📊 **Cache Metadata** - Know when data was cached and when it expires
* 🎯 **LRU Eviction** - Automatic eviction of old entries when cache is full
* 🔧 **Customizable** - Custom TTL, methods, key generation, and storage
* 💾 **Storage Adapters** - Bring your own storage (localStorage, Redis, etc.)

## Installation

```bash
npm install @endpoint-fetcher/cache
```

**Peer dependency:** `endpoint-fetcher` ^2.0.0

## Quick Start

```typescript
import { createApiClient, get } from 'endpoint-fetcher';
import { cache, CachingWrapper } from 'endpoint-fetcher-cache';

type User = { id: string; name: string; email: string };

const api = createApiClient({
  users: {
    endpoints: {
      // Important: Output type must be CachingWrapper<T>
      getAll: get<void, CachingWrapper<User[]>>('/users'),
      getById: get<{ id: string }, CachingWrapper<User>>((input) => `/users/${input.id}`)
    }
  }
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    cache({ ttl: 300 }) // Cache for 5 minutes
  ]
});

// First call - fetches from API
const result = await api.users.getAll();
console.log(result.data);        // User[]
console.log(result.cachedAt);    // Date when cached
console.log(result.expiresAt);   // Date when expires
console.log(result.isStale);     // false

// Second call - returns from cache (if within TTL)
const cached = await api.users.getAll();
console.log(cached.cachedAt === result.cachedAt); // true (same cache)

// Manually refresh
const refreshed = await result.refresh();
console.log(refreshed.data); // Fresh data from API

// Invalidate cache
result.invalidate();
```

## API Reference

### `cache(config?)`

Creates a caching plugin for endpoint-fetcher.

**Parameters:**

```typescript
{
  ttl?: number;              // Time to live in seconds (default: 300)
  methods?: string[];        // HTTP methods to cache (default: ['GET'])
  maxSize?: number;          // Max cache entries (default: Infinity)
  keyGenerator?: (method: string, path: string, input: any) => string;
  storage?: CacheStorage;    // Custom storage adapter
}
```

**Returns:** Plugin instance for use with endpoint-fetcher

### `CachingWrapper<T>`

The wrapper type that adds caching metadata to your response type.

```typescript
type CachingWrapper<T> = {
  data: T;                   // The actual data
  cachedAt: Date;           // When it was cached
  expiresAt: Date;          // When it expires
  isStale: boolean;         // Whether it's expired
  refresh: () => Promise<CachingWrapper<T>>;  // Refresh the data
  invalidate: () => void;   // Remove from cache
};
```

### `CacheStorage` Interface

Implement this interface to create custom storage adapters:

```typescript
interface CacheStorage {
  get(key: string): CacheEntry | undefined;
  set(key: string, value: CacheEntry): void;
  delete(key: string): void;
  clear(): void;
  keys(): string[];
}

interface CacheEntry {
  data: any;
  cachedAt: Date;
  expiresAt: Date;
}
```

## Usage Examples

### Basic Caching

```typescript
import { createApiClient, get } from 'endpoint-fetcher';
import { cache, CachingWrapper } from 'endpoint-fetcher-cache';

type Post = { id: string; title: string; content: string };

const api = createApiClient({
  posts: {
    endpoints: {
      getAll: get<void, CachingWrapper<Post[]>>('/posts'),
      getById: get<{ id: string }, CachingWrapper<Post>>((input) => `/posts/${input.id}`)
    }
  }
}, {
  baseUrl: 'https://api.example.com',
  plugins: [cache({ ttl: 600 })] // 10 minutes
});

const posts = await api.posts.getAll();
console.log('Cached at:', posts.cachedAt);
console.log('Expires at:', posts.expiresAt);
console.log('Data:', posts.data);
```

### Custom TTL Per Endpoint

```typescript
// You can use multiple cache plugin instances for different TTLs
const api = createApiClient({
  fastChanging: {
    endpoints: {
      getData: get<void, CachingWrapper<Data>>('/fast')
    }
  },
  slowChanging: {
    endpoints: {
      getData: get<void, CachingWrapper<Data>>('/slow')
    }
  }
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    cache({ ttl: 60 })  // Default: 1 minute
  ]
});

// Or apply at group level
const api2 = createApiClient({
  fast: group({
    endpoints: {
      getData: get<void, CachingWrapper<Data>>('/fast')
    }
  }),
  slow: group({
    endpoints: {
      getData: get<void, CachingWrapper<Data>>('/slow')
    }
  })
}, {
  baseUrl: 'https://api.example.com',
  plugins: [cache({ ttl: 300 })]
});
```

### Checking Cache Freshness

```typescript
const result = await api.users.getById({ id: '123' });

if (result.isStale) {
  console.log('Data is stale, consider refreshing');
  const fresh = await result.refresh();
  console.log('Refreshed data:', fresh.data);
} else {
  console.log('Data is fresh:', result.data);
}

// Calculate remaining cache time
const now = new Date();
const remainingMs = result.expiresAt.getTime() - now.getTime();
const remainingSec = Math.floor(remainingMs / 1000);
console.log(`Cache expires in ${remainingSec} seconds`);
```

### Manual Cache Management

```typescript
const result = await api.users.getAll();

// Force refresh (bypasses cache)
const refreshed = await result.refresh();
console.log('Fresh data:', refreshed.data);

// Invalidate specific cache entry
result.invalidate();

// Next call will fetch from API
const fresh = await api.users.getAll();
console.log('Fetched from API:', fresh.data);
```

### Cache Specific Methods

```typescript
const api = createApiClient({
  users: {
    endpoints: {
      getAll: get<void, CachingWrapper<User[]>>('/users'),
      create: post<CreateUserInput, CachingWrapper<User>>('/users')
    }
  }
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    cache({
      ttl: 300,
      methods: ['GET', 'POST'] // Cache both GET and POST
    })
  ]
});
```

### Custom Cache Key Generation

```typescript
const api = createApiClient({
  users: {
    endpoints: {
      getAll: get<{ page?: number }, CachingWrapper<User[]>>('/users')
    }
  }
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    cache({
      ttl: 300,
      // Custom key generator ignores page parameter
      keyGenerator: (method, path, input) => {
        return `${method}:${path}`; // Ignores input
      }
    })
  ]
});

// Both calls use same cache entry
const page1 = await api.users.getAll({ page: 1 });
const page2 = await api.users.getAll({ page: 2 });
console.log(page1.cachedAt === page2.cachedAt); // true
```

### Limited Cache Size (LRU)

```typescript
const api = createApiClient({
  users: {
    endpoints: {
      getById: get<{ id: string }, CachingWrapper<User>>((input) => `/users/${input.id}`)
    }
  }
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    cache({
      ttl: 600,
      maxSize: 100 // Keep only 100 most recently used entries
    })
  ]
});

// When cache exceeds 100 entries, oldest entries are removed
for (let i = 0; i < 150; i++) {
  await api.users.getById({ id: i.toString() });
}
// Only last 100 users are cached
```

### Custom Storage (localStorage)

```typescript
import { cache, CacheStorage, CacheEntry } from 'endpoint-fetcher-cache';

class LocalStorageCacheAdapter implements CacheStorage {
  private prefix = 'api-cache:';
  
  get(key: string): CacheEntry | undefined {
    const item = localStorage.getItem(this.prefix + key);
    if (!item) return undefined;
  
    const entry = JSON.parse(item);
    return {
      data: entry.data,
      cachedAt: new Date(entry.cachedAt),
      expiresAt: new Date(entry.expiresAt)
    };
  }
  
  set(key: string, value: CacheEntry): void {
    localStorage.setItem(
      this.prefix + key,
      JSON.stringify({
        data: value.data,
        cachedAt: value.cachedAt.toISOString(),
        expiresAt: value.expiresAt.toISOString()
      })
    );
  }
  
  delete(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }
  
  clear(): void {
    const keys = this.keys();
    keys.forEach(key => localStorage.removeItem(this.prefix + key));
  }
  
  keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        keys.push(key.substring(this.prefix.length));
      }
    }
    return keys;
  }
}

const api = createApiClient({
  users: {
    endpoints: {
      getAll: get<void, CachingWrapper<User[]>>('/users')
    }
  }
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    cache({
      ttl: 3600,
      storage: new LocalStorageCacheAdapter()
    })
  ]
});

// Cache persists across page reloads!
```

### Combining with Other Plugins

```typescript
import { createApiClient, get } from 'endpoint-fetcher';
import { cache, CachingWrapper } from 'endpoint-fetcher-cache';
import { retry } from 'endpoint-fetcher-retry'; // hypothetical

const api = createApiClient({
  users: {
    endpoints: {
      getAll: get<void, CachingWrapper<User[]>>('/users')
    }
  }
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    retry({ maxRetries: 3 }),  // Retry failed requests
    cache({ ttl: 300 })        // Then cache successful responses
  ]
});
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { api } from './api';
import type { CachingWrapper } from 'endpoint-fetcher-cache';

function useUsers() {
  const [result, setResult] = useState<CachingWrapper<User[]> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.users.getAll().then(data => {
      setResult(data);
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    if (result) {
      setLoading(true);
      const fresh = await result.refresh();
      setResult(fresh);
      setLoading(false);
    }
  };

  return {
    users: result?.data,
    cachedAt: result?.cachedAt,
    isStale: result?.isStale,
    loading,
    refresh
  };
}

// Usage in component
function UsersPage() {
  const { users, cachedAt, isStale, loading, refresh } = useUsers();

  return (
    <div>
      <button onClick={refresh}>Refresh</button>
      {loading && <p>Loading...</p>}
      {cachedAt && <p>Last updated: {cachedAt.toLocaleString()}</p>}
      {isStale && <p>⚠️ Data is stale</p>}
      <ul>
        {users?.map(user => <li key={user.id}>{user.name}</li>)}
      </ul>
    </div>
  );
}
```

## How It Works

### Type Transformation

The plugin uses TypeScript's type system to transform your endpoint's return type:

1. **You specify** : `get<void, CachingWrapper<User[]>>('/users')`
2. **API returns** : `User[]`
3. **Plugin wraps it** : Adds metadata and methods
4. **You receive** : `CachingWrapper<User[]>` with full type safety

### Cache Key Generation

By default, cache keys are generated from:

* HTTP method
* Request path
* Request input (JSON stringified)

Example: `GET:/users/123:{"includeProfile":true}`

### LRU Eviction

When `maxSize` is set, the cache uses Least Recently Used (LRU) eviction:

1. When cache reaches `maxSize` and a new entry is added
2. The least recently accessed entry is removed
3. Access order is updated on every `get()` operation

## TypeScript

The plugin is written in TypeScript and provides complete type safety:

```typescript
import { cache, CachingWrapper } from 'endpoint-fetcher-cache';

// ✅ Correct - output type is CachingWrapper<User[]>
const getUsers = get<void, CachingWrapper<User[]>>('/users');

// ❌ Type error - output type must be CachingWrapper<T>
const getUsers = get<void, User[]>('/users');
// If you use the cache plugin, TypeScript will complain because
// User[] !== CachingWrapper<User[]>
```

## Best Practices

### 1. Use Appropriate TTL

Choose TTL based on how frequently your data changes:

* **Static data** : 3600+ seconds (1+ hour)
* **Slow-changing** : 600-1800 seconds (10-30 minutes)
* **Medium** : 300-600 seconds (5-10 minutes)
* **Fast-changing** : 60-300 seconds (1-5 minutes)
* **Real-time** : Don't cache or use very short TTL (10-30 seconds)

### 2. Selective Caching

Only cache GET requests by default:

```typescript
cache({ methods: ['GET'] }) // Default
```

Only cache POST if responses are deterministic and safe to cache.

### 3. Monitor Cache Size

Set `maxSize` to prevent unbounded memory growth:

```typescript
cache({
  ttl: 300,
  maxSize: 1000 // Reasonable limit
})
```

### 4. Invalidate on Mutations

Invalidate relevant cache entries after mutations:

```typescript
const users = await api.users.getAll();

// After creating a user
await api.users.create({ name: 'John', email: 'john@example.com' });
users.invalidate(); // Clear cached users list

// Fetch fresh list
const updated = await api.users.getAll();
```

### 5. Handle Stale Data

Check `isStale` and refresh when needed:

```typescript
const result = await api.users.getAll();

if (result.isStale) {
  const fresh = await result.refresh();
  // Use fresh.data
} else {
  // Use result.data
}
```

## Advanced Patterns

### Automatic Refresh on Stale

```typescript
async function getUsers() {
  const result = await api.users.getAll();
  
  if (result.isStale) {
    return (await result.refresh()).data;
  }
  
  return result.data;
}
```

### Cache Warming

```typescript
// Warm cache on app startup
async function warmCache() {
  await api.users.getAll();
  await api.posts.getAll();
  console.log('Cache warmed');
}

warmCache();
```

### Conditional Caching

```typescript
const api = createApiClient({
  users: {
    endpoints: {
      // Cache list
      getAll: get<void, CachingWrapper<User[]>>('/users'),
      // Don't cache individual users (use different plugin instance)
      getById: get<{ id: string }, User>((input) => `/users/${input.id}`)
    }
  }
}, {
  baseUrl: 'https://api.example.com',
  plugins: [
    cache({ ttl: 300, methods: ['GET'] })
  ]
});
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Related

* [endpoint-fetcher](https://github.com/lorenzo-vecchio/endpoint-fetcher) - The main library
