
// This version number is incremented to trigger the 'install' event and update the cache.
const CACHE_NAME = 'lawyer-app-cache-v30-11-2025';

// The list of URLs to cache has been expanded to include all critical,
// external dependencies. This ensures the app is fully functional offline
// immediately after the service worker is installed.
const urlsToCache = [
  './',
  './index.html',
  './index.js',
  './manifest.json',
  './icon.svg',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap',
  // Google Fonts files (specific woff2 files often used by browsers)
  'https://fonts.gstatic.com/s/tajawal/v10/Iura6YBj_oCad4k1nzSBC45I.woff2',
  'https://fonts.gstatic.com/s/tajawal/v10/Iura6YBj_oCad4k1nzGFC45I.woff2',
  'https://fonts.gstatic.com/s/tajawal/v10/Iura6YBj_oCad4k1nzGVC45I.woff2',
  'https://fonts.gstatic.com/s/tajawal/v10/Iura6YBj_oCad4k1nzGjC45I.woff2',
  // Pinning specific versions from esm.sh for better cache stability.
  'https://esm.sh/@google/genai@^1.20.0',
  'https://esm.sh/@supabase/supabase-js@^2.44.4',
  'https://esm.sh/react@^19.1.1',
  'https://esm.sh/react-dom@^19.1.1/client',
  'https://esm.sh/react@^19.1.1/jsx-runtime',
  'https://esm.sh/recharts@^2.12.7',
  'https://esm.sh/idb@^8.0.0',
  'https://esm.sh/docx-preview@^0.1.20',
  'https://esm.sh/pdfjs-dist@^4.4.178',
  'https://esm.sh/pdfjs-dist@4.4.178/build/pdf.worker.mjs',
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell and essential assets.');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Service Worker: Failed to cache assets during install:', error);
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients and notifying for reload.');
      return self.clients.claim().then(() => {
        // After claiming, send a message to all clients to reload.
        self.clients.matchAll().then(clients => {
          clients.forEach(client => client.postMessage({ type: 'RELOAD_PAGE_NOW' }));
        });
      });
    })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.includes('supabase.co')) {
    return;
  }

  const url = new URL(event.request.url);

  // Use a Network First strategy for the app's core files.
  // This ensures users get the latest version if they are online.
  if (event.request.mode === 'navigate' || url.pathname === '/index.js' || url.pathname === '/manifest.json') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If the fetch is successful, cache it for offline use.
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        })
        .catch(() => {
          // If the network fails, serve the cached version as a fallback.
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // For navigation, if the specific page isn't cached, fall back to the root.
            if (event.request.mode === 'navigate') {
              return caches.match('./');
            }
            // If a core asset isn't in the cache and network fails, there's nothing to serve.
            return new Response(`Resource not available offline: ${url.pathname}`, {
              status: 404,
              headers: { 'Content-Type': 'text/plain' },
            });
          });
        })
    );
    return;
  }

  // Use a Cache First strategy for all other assets (fonts, third-party libraries).
  // These are less likely to change and this provides the best performance.
  event.respondWith(
    caches.match(event.request).then(response => {
      // If we have a cached response, return it immediately.
      if (response) {
        return response;
      }

      // If not, fetch from the network, cache it for future requests, and then return it.
      return fetch(event.request).then(networkResponse => {
        // Check for a valid response to cache. Opaque responses are for no-cors CDNs.
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        
        return networkResponse;
      });
    })
  );
});