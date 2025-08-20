const CACHE_NAME = 'megafon-tariff-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css', // This would be the name of your CSS file if you extracted it
  '/script.js',  // This would be the name of your JS file if you extracted it
  '/manifest.json',
  '/icon.jpg',
  '/icons/icon-512x512.png',
  'https://shop.megafon.tj/_nuxt/788_ru.DDZlxzsT.jpg',
  './internet.png',
  './call.png',
  './oilatvicon.png',
  './iviicon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});


