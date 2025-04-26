/*
 Service Worker for المسبحة PWA
 Handles caching for offline use and periodic reminders.
*/

const CACHE_NAME = 'almisbahah-cache-v2'; // Increment version if cached files change significantly

// List of files to cache when the service worker is installed
// Ensure these paths are correct relative to the root directory
const urlsToCache = [
  '/', // Cache the root URL (important for accessing the app entry point)
  'index.html', // <<--- !!! IMPORTANT: Change this to 'مسبحة الأذكار.html' if that is your actual HTML file name !!!
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'icons/whatsapp-icon.png',
  'icons/telegram-icon.png',
  'icons/copy-link-icon.png',
  // Add other essential static assets if any (e.g., specific fonts if locally hosted)
];

// --- Service Worker Lifecycle Events ---

// Install event: Cache core assets
self.addEventListener('install', event => {
  console.log('[SW] Event: Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell defined in urlsToCache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Installation complete, activating immediately.');
        return self.skipWaiting(); // Force the waiting service worker to become the active service worker
      })
      .catch(error => {
        console.error('[SW] Caching failed during install:', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Event: Activate');
  // Define the current cache whitelist
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches that are not in the whitelist
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete, claiming clients.');
      return self.clients.claim(); // Take control of uncontrolled clients (tabs/windows)
    })
  );
});

// Fetch event: Serve cached assets or fetch from network (Cache-first strategy)
self.addEventListener('fetch', event => {
    // We only want to handle GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Cache hit - return cached response
                if (cachedResponse) {
                    // console.log('[SW] Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                // Not in cache - fetch from network
                // console.log('[SW] Fetching from network:', event.request.url);
                return fetch(event.request)
                    .then(networkResponse => {
                        // Optional: Cache newly fetched resources if needed
                        // Be cautious about caching everything dynamically
                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('[SW] Fetch failed for', event.request.url, ';', error);
                        // Optional: Return a specific offline fallback page
                        // return caches.match('/offline.html');
                    });
            })
    );
});


// --- Periodic Background Sync Logic for Daily Reminders ---

// Reminder times in 24-hour format { hour, minute, label }
const REMINDER_TIMES = [
    { hour: 8, minute: 0, label: 'الصباح' },   // 8:00 AM
    { hour: 14, minute: 0, label: 'بعد الظهر' }, // 2:00 PM
    { hour: 18, minute: 0, label: 'المساء' },  // 6:00 PM
    { hour: 21, minute: 0, label: 'بعد العشاء' } // 9:00 PM
];

// Time window (in minutes) *after* the target time to check for the reminder
const REMINDER_WINDOW_MINUTES = 20;

self.addEventListener('periodicsync', event => {
    console.log('[SW] Event: Periodic Sync received', event);

    if (event.tag === 'dhikr-reminder') {
        console.log('[SW] Dhikr reminder sync triggered');
        event.waitUntil(
            (async () => {
                const now = new Date();
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentTimeInMinutes = currentHour * 60 + currentMinute;

                console.log(`[SW] Current time for sync check: ${currentHour}:${currentMinute}`);

                // Find if the current time falls within the window of any reminder time
                const triggeredReminder = REMINDER_TIMES.find(reminder => {
                    const reminderTimeInMinutes = reminder.hour * 60 + reminder.minute;
                    const reminderWindowEndInMinutes = reminderTimeInMinutes + REMINDER_WINDOW_MINUTES;
                    // Check if current time is between reminder start and reminder end window
                    return currentTimeInMinutes >= reminderTimeInMinutes && currentTimeInMinutes < reminderWindowEndInMinutes;
                });

                // If a reminder time window is matched, show the notification
                if (triggeredReminder) {
                    console.log(`[SW] Time matches ${triggeredReminder.hour}:${triggeredReminder.minute} window, attempting to show notification.`);
                    // Check for notification permission *before* showing
                    const permissionStatus = await self.permissionState({ name: 'notifications' });
                    if (permissionStatus !== 'granted') {
                        console.warn('[SW] Notification permission not granted. Cannot show reminder.');
                        return; // Exit if permission is not granted
                    }

                    try {
                        await self.registration.showNotification(`تذكير ${triggeredReminder.label}: حان وقت الأذكار`, {
                            body: 'لا تنسَ أذكار الصباح/المساء أو الأذكار التي اعتدت عليها باستخدام المسبحة.',
                            icon: '/icons/icon-192x192.png', // Use a suitable icon
                            badge: '/icons/icon-192x192.png', // Badge often uses same small icon or a dedicated one
                            vibrate: [100, 50, 100], // Short vibration pattern
                            data: {
                                url: self.location.origin + '/index.html' // <<--- !!! IMPORTANT: Change this to 'مسبحة الأذكار.html' if that is your actual HTML file name !!!
                                // URL to open when notification is clicked (use the correct HTML file name)
                            },
                            renotify: true, // Allows replacing old notifications with the same tag
                            tag: 'dhikr-reminder-' + triggeredReminder.hour // Group notifications by hour
                        });
                        console.log('[SW] Notification shown successfully for hour:', triggeredReminder.hour);
                    } catch (error) {
                        console.error('[SW] Failed to show notification:', error);
                    }
                } else {
                     console.log(`[SW] Periodic Sync fired, but time (${currentHour}:${currentMinute}) is outside any reminder window.`);
                }
            })()
        );
    }
});

// --- Notification Click Logic ---
// Opens the app when the notification is clicked
self.addEventListener('notificationclick', event => {
    console.log('[SW] Event: Notification click received', event);

    event.notification.close(); // Close the notification drawer

    const urlToOpen = event.notification.data && event.notification.data.url
                       ? event.notification.data.url
                       : self.location.origin; // Fallback to origin if no URL in data

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Check if a window/tab matching the URL is already open.
            for (const client of clientList) {
                // Use startsWith for flexibility if URL has params later
                if (client.url.startsWith(urlToOpen) && 'focus' in client) {
                    console.log('[SW] Focusing existing client window.');
                    return client.focus();
                }
            }
            // If no window is open, open a new one.
            console.log('[SW] No existing client found, opening new window for:', urlToOpen);
            return clients.openWindow(urlToOpen);
        })
    );
});
