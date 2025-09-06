// sw.js

// Имя и версия кэша. Меняйте версию, когда обновляете файлы.
const CACHE_NAME = 'life-constructor-v1.1';

// Список всех файлов, которые нужно сохранить для офлайн-работы
const URLS_TO_CACHE = [
  '/',
  'index.html',
  // Шрифты и стили
  'https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&family=Lato:ital,wght@0,100..900;1,100..900&display=swap',
  // Изображения
  'https://shop.megafon.tj/_nuxt/788_ru.DDZlxzsT.jpg',
  'https://shop-megafontj.github.io/tariff/internet.png',
  'https://shop-megafontj.github.io/tariff/call.png',
  'https://shop-megafontj.github.io/tariff/oilatvicon.png',
  'https://shop-megafontj.github.io/tariff/iviicon.png',
  'https://shop.megafon.tj/favicon.ico',
  // Файл манифеста для PWA
  'manifest.json'
];

/**
 * Этап 1: Установка Service Worker
 * - Открывается кэш с заданным именем.
 * - Все файлы из списка URLS_TO_CACHE загружаются и сохраняются в кэш.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Кэш открыт');
        return cache.addAll(URLS_TO_CACHE);
      })
      .catch(err => {
        console.error('Ошибка при кэшировании файлов:', err);
      })
  );
});

/**
 * Этап 2: Активация Service Worker
 * - Этот этап наступает после успешной установки.
 * - Здесь мы удаляем старые версии кэша, чтобы приложение всегда использовало актуальные файлы.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: очистка старого кэша');
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

/**
 * Этап 3: Перехват запросов (Fetch)
 * - Service Worker перехватывает все сетевые запросы со страницы.
 * - Сначала он ищет ответ в кэше.
 * - Если находит (Cache hit) — мгновенно отдает сохраненный файл, не обращаясь к сети.
 * - Если не находит — пытается загрузить файл из интернета.
 * - Это и обеспечивает работу офлайн.
 */
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Если ресурс есть в кэше, возвращаем его
        if (response) {
          return response;
        }
        // Иначе, делаем запрос к сети
        return fetch(event.request);
      })
  );
});
