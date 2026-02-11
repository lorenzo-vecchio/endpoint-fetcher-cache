import { cache } from './src/index';
import { createApiClient, get } from 'endpoint-fetcher';
import { createMockFetch } from 'endpoint-fetcher/tests/mock-fetch';

// Test that plugin methods are properly typed
const mockFetch = createMockFetch({ body: [] });
const client = createApiClient(
  { users: get<void, any>('/users') },
  {
    baseUrl: 'https://api.example.com',
    fetch: mockFetch,
    plugins: [cache()],
  }
);

// These should all work with proper typing
console.log('Testing cache plugin methods...');

// Access plugin methods
if (client.plugins) {
  console.log('plugins property exists:', !!client.plugins);
  console.log('cache plugin exists:', !!client.plugins.cache);
  
  // Test clear method
  console.log('clear method type:', typeof client.plugins.cache.clear);
  client.plugins.cache.clear();
  
  // Test invalidate method
  console.log('invalidate method type:', typeof client.plugins.cache.invalidate);
  client.plugins.cache.invalidate('GET', '/users', undefined);
  
  // Test invalidateKey method
  console.log('invalidateKey method type:', typeof client.plugins.cache.invalidateKey);
  client.plugins.cache.invalidateKey('key');
  
  console.log('All cache plugin methods work correctly!');
} else {
  console.error('ERROR: plugins property not found on client');
  process.exit(1);
}