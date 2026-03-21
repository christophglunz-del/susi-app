// Service Worker für Susi's Alltagshilfe PWA
const CACHE_NAME = 'susi-app-v9';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './pages/kunden.html',
  './pages/leistung.html',
  './pages/fahrten.html',
  './pages/termine.html',
  './pages/abtretung.html',
  './pages/rechnung.html',
  './pages/entlastung.html',
  './pages/settings.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/kunden.js',
  './js/leistung.js',
  './js/fahrten.js',
  './js/termine.js',
  './js/abtretung.js',
  './js/rechnung.js',
  './js/settings.js',
  './js/signature.js',
  './js/pdf.js',
  './js/lexoffice.js',
  './js/entlastung.js',
  './js/sipgate.js',
  './js/letterxpress.js',
  './js/gcal.js',
  './manifest.json'
];

// CDN-Ressourcen die gecacht werden sollen
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js'
];

// Installation: Alle Assets cachen
self.addEventListener('install', event => {
  console.log('[SW] Installation gestartet');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cache geöffnet, Assets werden gecacht');
      // Lokale Assets zuerst
      const localPromise = cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[SW] Einige lokale Assets konnten nicht gecacht werden:', err);
      });
      // CDN Assets einzeln cachen (Fehler bei einzelnen ignorieren)
      const cdnPromises = CDN_ASSETS.map(url =>
        cache.add(url).catch(err => {
          console.warn('[SW] CDN-Asset konnte nicht gecacht werden:', url, err);
        })
      );
      return Promise.all([localPromise, ...cdnPromises]);
    })
  );
  // Sofort aktivieren ohne auf andere Tabs zu warten
  self.skipWaiting();
});

// Aktivierung: Alte Caches löschen
self.addEventListener('activate', event => {
  console.log('[SW] Aktiviert');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Alter Cache gelöscht:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  // Sofort für alle Clients übernehmen
  self.clients.claim();
});

// Fetch: Network-First-Strategie mit Cache-Fallback
self.addEventListener('fetch', event => {
  // Nur GET-Requests cachen
  if (event.request.method !== 'GET') return;

  // API-Requests (Proxy / Lexoffice) NICHT cachen — direkt ans Netzwerk
  const url = new URL(event.request.url);
  if (url.port === '8484' || url.hostname === 'api.lexoffice.io' || url.hostname === 'api.sipgate.com') return;

  event.respondWith(
    fetch(event.request).then(networkResponse => {
      // Netzwerk erfolgreich → Cache aktualisieren
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
      }
      return networkResponse;
    }).catch(() => {
      // Offline → aus Cache liefern
      return caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
        return new Response('Offline - Ressource nicht verfügbar', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      });
    })
  );
});

// Sync-Event für spätere Background-Sync-Funktionalität
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background Sync ausgelöst');
    // Platzhalter für zukünftige Sync-Logik
  }
});
