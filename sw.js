// Nama cache kita. Ubah versi jika ada file baru yang ingin di-cache.
const CACHE_NAME = 'kasirku-cache-v1';

// Daftar file yang perlu di-cache agar aplikasi bisa berjalan offline.
const URLS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    'https://www.proweb.co.id/a/pwa/icon-192x192.png',
    'https://www.proweb.co.id/a/pwa/icon-512x512.png'
];

// Event 'install': Dijalankan saat service worker pertama kali di-install.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache dibuka');
                return cache.addAll(URLS_TO_CACHE);
            })
    );
});

// Event 'fetch': Dijalankan setiap kali aplikasi meminta sebuah resource (file, gambar, dll).
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Jika resource ada di cache, kembalikan dari cache.
                if (response) {
                    return response;
                }
                // Jika tidak ada, coba ambil dari jaringan (internet).
                return fetch(event.request);
            })
    );
});
