// Service worker: deja la app entera guardada en la tablet para que funcione sin internet.
// Estrategia: primero la red (así los cambios en los JSON llegan solos) y, si no hay
// red o tarda, la copia guardada. Los vídeos y el reconocimiento de voz no pasan por aquí.
const CACHE = 'ingles-a1-v1';

const CORE = [
  './', 'index.html', 'manifest.json',
  'css/base.css', 'css/components.css', 'css/games.css',
  'js/app.js',
  'js/core/util.js', 'js/core/store.js', 'js/core/content.js', 'js/core/srs.js', 'js/core/path.js',
  'js/core/i18n.js', 'js/core/speech.js', 'js/core/backup.js', 'js/core/nav.js', 'js/core/session.js',
  'js/core/theme.js',
  'js/ui/feedback.js', 'js/ui/layout.js', 'js/ui/charts.js', 'js/ui/keyboard.js',
  'js/screens/home.js', 'js/screens/play.js', 'js/screens/pronunciation.js', 'js/screens/writing.js',
  'js/screens/grammar.js', 'js/screens/song.js', 'js/screens/progress.js', 'js/screens/settings.js', 'js/screens/welcome.js',
  'js/games/match.js', 'js/games/intruder.js', 'js/games/scramble.js', 'js/games/taps.js',
  'js/games/memory.js', 'js/games/silly.js',
  'data/blocks.json', 'data/grammar.json', 'data/silly.json', 'data/songs.json',
  'data/ui-strings.json', 'data/medals.json',
  'assets/nunito.woff2', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);
    // Los archivos de bloques se leen del índice: añadir un bloque no obliga a tocar esto.
    try {
      const index = await (await fetch('data/blocks.json', { cache: 'no-cache' })).json();
      await cache.addAll(index.blocks.map(b => 'data/blocks/' + b.file));
    } catch (e) { /* se guardarán al usarlos */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function answer(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  const network = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  });
  if (!cached) {
    return network.catch(async () =>
      (request.mode === 'navigate' && await cache.match('index.html')) || Response.error());
  }
  network.catch(() => {});
  const slow = new Promise(resolve => setTimeout(() => resolve(cached), 2500));
  return Promise.race([network.catch(() => cached), slow]);
}

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(answer(event.request));
});
