const CACHE_NAME = 'dhikr-misbaha-cache-v1'; // Change version if you update resources
const urlsToCache = [
  '/', // Cache the root URL (often serves index.html)
  'مسبحة الأذكار.html', // Cache the main HTML file (use exact name)
  // Add CSS file if you separate it later: 'styles.css'
  // Add JS file if you separate it later: 'script.js'
  // Add main icons used in manifest and HTML
  'icons/icon-192x192.png',
  'icons/icon-512x512.png'
  // Add any other essential static assets here (e.g., fonts, other images)
];

// Install event: Cache core assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting(); // Activate worker immediately
      })
      .catch(error => {
        console.error('Service Worker: Caching failed', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  const cacheWhitelist = [CACHE_NAME]; // Only keep the current cache version
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
      console.log('Service Worker: Activation complete');
      return self.clients.claim(); // Take control of open pages immediately
    })
  );
});

// Fetch event: Serve cached assets or fetch from network
self.addEventListener('fetch', event => {
    // console.log('Service Worker: Fetching ', event.request.url); // Uncomment for debugging fetches
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    // console.log('Service Worker: Serving from cache:', event.request.url); // Debug log
                    return response;
                }

                // Not in cache - fetch from network
                // console.log('Service Worker: Fetching from network:', event.request.url); // Debug log
                return fetch(event.request)
                    .then(networkResponse => {
                        // Optional: Cache dynamically fetched resources if needed
                        // Be careful caching everything, especially external resources or POST requests
                        // if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                        //     const responseToCache = networkResponse.clone();
                        //     caches.open(CACHE_NAME)
                        //         .then(cache => {
                        //             cache.put(event.request, responseToCache);
                        //         });
                        // }
                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('Service Worker: Fetch failed;', error);
                        // Optional: Return a fallback offline page if fetch fails
                        // return caches.match('/offline.html');
                    });
            })
    );
});