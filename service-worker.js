/* Urologger — cache offline.
   A versão anterior nunca chegou a rodar: o index.html não registrava o
   service worker. E, se registrasse, falharia por inteiro — cache.addAll
   rejeita tudo se um único item falhar, e a lista apontava para Tailwind,
   Chart.js e jsPDF, que o aplicativo não usa mais. Aqui cada arquivo é
   cacheado individualmente, e o essencial nunca depende do opcional. */

const CACHE = 'urologger-v7.2';

/* Sem estes o aplicativo não abre. */
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* OCR: pesado e opcional. A leitura funciona sem ele. */
const OPCIONAIS = [
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  './vendor/tesseract/lang/eng.traineddata.gz'
];

async function cacheEach(cache, urls) {
  const results = await Promise.allSettled(urls.map(u => cache.add(u)));
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.warn('[SW] não cacheado:', urls[i], r.reason);
  });
  return results;
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cacheEach(cache, ESSENCIAIS);
    cacheEach(cache, OPCIONAIS);   // em segundo plano: não bloqueia a instalação
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* Cache primeiro (funciona offline); rede em segundo plano para atualizar. */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    const rede = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (hit) return hit;
    const res = await rede;
    if (res) return res;
    if (req.mode === 'navigate') {
      const inicio = await cache.match('./index.html');
      if (inicio) return inicio;
    }
    return new Response('Recurso indisponível offline.', { status: 503, statusText: 'Offline' });
  })());
});
