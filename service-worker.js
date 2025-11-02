const CACHE_NAME = 'megafon-templates-v1';

// Список всех файлов "оболочки" приложения, которые нужно закэшировать
const URLS_TO_CACHE = [
  '/', // Для корневого запроса
  'login.html',
  'operator.html',
  'admin.html',
  'login.js',
  'operator.js',
  'admin.js',
  // Логотип, иконки и внешние скрипты
  'https://shop.megafon.tj/favicon.ico',
  'manifest1.json',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'https://unpkg.com/feather-icons',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js'
];

// 1. Установка Service Worker (Кэширование)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кэш открыт, добавляем файлы оболочки');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error('Ошибка кэширования при установке:', err);
      })
  );
});

// 2. Активация Service Worker (Очистка старого кэша)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. Перехват запросов (Стратегия "Cache First")
self.addEventListener('fetch', event => {
  // Мы кэшируем только GET-запросы
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Если ответ есть в кэше, отдаем его
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Если в кэше нет, идем в сеть
        // Мы не кэшируем запросы к Firebase DB, только оболочку!
        return fetch(event.request);
      })
  );
});