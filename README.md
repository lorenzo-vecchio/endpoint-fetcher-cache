# @endpoint-fetcher/cache

A caching plugin for [endpoint-fetcher](https://github.com/lorenzo-vecchio/endpoint-fetcher) that adds intelligent caching with type-safe metadata.

## Features

* 🔒 **Fully Type-Safe** - Complete inference for your cached data.
* ⚡ **Metadata Aware** - Know exactly when data was `cachedAt` or if it `isStale`.
* 🔄 **Built-in Actions** - Programmatically `refresh()` or `invalidate()` from the response.
* 💾 **Storage Adapters** - Plug-and-play storage (Memory, localStorage, etc.).
* 🎯 **LRU Eviction** - Automatically cleans up old entries when the limit is reached.

## Installation

```bash
npm install @endpoint-fetcher/cache
```
*Requires `endpoint-fetcher` ^2.0.0*

## Quick Start

```typescript
import { createApiClient, get } from 'endpoint-fetcher';
import { cache, CachingWrapper } from '@endpoint-fetcher/cache';

const api = createApiClient({
  users: {
    endpoints: {
      // Wrap your return type with CachingWrapper<T>
      getAll: get<void, CachingWrapper<User[]>>('/users'),
    }
  }
}, {
  baseUrl: '[https://api.example.com](https://api.example.com)',
  plugins: [
    cache({ ttl: 300 }) // Global TTL: 5 minutes
  ]
});

// Usage
const result = await api.users.getAll();

console.log(result.data);      // User[]
console.log(result.isStale);   // false
console.log(result.expiresAt); // Date

// Force a network refresh
const fresh = await result.refresh();

// Remove this specific entry from cache
result.invalidate();
```

## API Reference

### `cache(config?)`
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `ttl` | `number` | `300` | Global time-to-live in seconds. |
| `maxSize` | `number` | `Infinity` | Max number of entries (LRU). |
| `methods` | `string[]` | `['GET']` | HTTP methods to cache. |
| `storage` | `CacheStorage`| `Memory` | Custom storage (e.g., localStorage). |

### `CachingWrapper<T>`
The response object returned by your API calls:
* `data: T` - The actual API response.
* `cachedAt: Date` - Timestamp of the original fetch.
* `expiresAt: Date` - When the entry will be considered stale.
* `isStale: boolean` - Helper to check if TTL has passed.
* `refresh(): Promise<CachingWrapper<T>>` - Re-fetches from network.
* `invalidate(): void` - Clears this entry from cache.

## Custom Storage
You can persist cache across sessions using `localStorage`:

```typescript
const api = createApiClient({...}, {
  plugins: [
    cache({
      ttl: 3600,
      storage: {
        get: (key) => JSON.parse(localStorage.getItem(key)),
        set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
        delete: (key) => localStorage.removeItem(key),
        keys: () => Object.keys(localStorage),
        clear: () => localStorage.clear()
      }
    })
  ]
});
```

## License
MIT