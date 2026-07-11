// Service Worker de PokemoNAZAR
// Estrategia: "stale-while-revalidate" simplificada, SOLO para archivos del
// propio sitio (el index.html, este mismo sw.js, etc).
//   1. Si hay una copia en caché, la sirve al instante (carga rápida / offline).
//   2. En paralelo, siempre pide la versión real al servidor.
//   3. Si el servidor devuelve algo distinto a lo cacheado, actualiza el caché
//      para la PRÓXIMA vez que se abra la app (no interrumpe la sesión actual).
// Subir un index.html nuevo a GitHub Pages hace que, la próxima vez que se
// abra la app instalada, el Service Worker detecte la diferencia y quede
// actualizado — sin que el usuario tenga que borrar ni reinstalar nada.
//
// IMPORTANTE: el juego depende de decenas de llamadas a dominios externos
// (pokeapi.co para Pokémon/stats/movimientos, raw.githubusercontent.com para
// los cries de audio, fuentes de Google, etc). Este Service Worker NO debe
// tocar esas llamadas — solo cachea archivos que viven en este mismo sitio.
// Interceptarlas rompía esas respuestas y colgaba el juego en "Preparando...".

const CACHE_NAME = 'pokemonazar-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Dejar pasar SIN TOCAR cualquier pedido que no sea a este mismo sitio
  // (PokeAPI, sprites, cries de audio, fuentes, analytics, etc). El navegador
  // maneja esos fetches normalmente, como si no hubiera Service Worker.
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      // Si hay copia cacheada, servirla al instante (rápido + funciona offline).
      // La red sigue corriendo en paralelo y actualiza el caché para la próxima vez.
      if (cached) {
        networkFetch; // no se espera, corre en segundo plano
        return cached;
      }

      // Sin caché todavía (primera visita): esperar la red.
      const networkResponse = await networkFetch;
      return networkResponse || new Response('Offline y sin caché disponible', { status: 503 });
    })
  );
});
