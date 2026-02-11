import { cache, CachingWrapper } from './src/index';
import { createApiClient, get } from 'endpoint-fetcher';

// Test 1: Verify cache plugin creation
const plugin = cache();
console.log('Plugin name:', plugin.name); // Should be 'cache'
console.log('Has methods:', !!plugin.methods); // Should be true
console.log('Has clear method:', !!plugin.methods?.clear); // Should be true
console.log('Has invalidate method:', !!plugin.methods?.invalidate); // Should be true
console.log('Has invalidateKey method:', !!plugin.methods?.invalidateKey); // Should be true

// Test 2: Type inference for plugin methods
type CacheMethods = typeof plugin.methods;
// These should all be valid TypeScript
const methods: CacheMethods = {
  clear: () => {},
  invalidate: (method: string, path: string, input: any) => {},
  invalidateKey: (key: string) => {},
};

// Test 3: Verify the plugin works with createApiClient type inference
// This is a compile-time test - if it compiles, the types work
declare const mockFetch: typeof fetch;
const client = createApiClient(
  { 
    users: get<void, CachingWrapper<Array<{ id: number; name: string }>>>('/users') 
  },
  {
    baseUrl: 'https://api.example.com',
    fetch: mockFetch,
    plugins: [cache()],
  }
);

// These should all be valid TypeScript accesses
if (client.plugins) {
  // Access cache plugin methods
  client.plugins.cache.clear();
  client.plugins.cache.invalidate('GET', '/users', undefined);
  client.plugins.cache.invalidateKey('some-key');
  
  // The endpoint should return CachingWrapper type
  client.users().then(result => {
    // result should have CachingWrapper properties
    const data = result.data; // Array<{ id: number; name: string }>
    const cachedAt = result.cachedAt; // Date
    const isStale = result.isStale; // boolean
    result.refresh(); // Promise<CachingWrapper<...>>
    result.invalidate(); // void
  });
}

console.log('Type tests passed!');