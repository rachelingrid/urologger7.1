/* Urologger — cache offline.
   A versão anterior nunca chegou a rodar: o index.html não registrava o
   service worker. E, se registrasse, falharia por inteiro — cache.addAll
   rejeita tudo se um único item falhar, e a lista apontava para Tailwind,
   Chart.js e jsPDF, que o aplicativo não usa mais. Aqui cada arquivo é
   cacheado individualmente, e o essencial nunca depende do opcional. */

const CACHE = 'urologger-v7.6';

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

/* Estratégia por tipo de recurso.

   A página (HTML) vai à REDE PRIMEIRO. A versão anterior era cache-primeiro
   para tudo, e isso tem uma consequência cruel: depois de publicar um
   index.html novo, o celular continuava mostrando o antigo indefinidamente —
   o aplicativo parecia não ter sido atualizado. Agora, havendo rede, a página
   é sempre a publicada; sem rede, vem do cache e tudo continua funcionando.

   Os arquivos pesados do OCR vão a cache primeiro: são imutáveis dentro de
   uma versão e baixá-los de novo a cada abertura seria desperdício. */

function ehPagina(req){
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (ehPagina(req)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true }) ||
                    await cache.match('./index.html');
        if (hit) return hit;
        return new Response('Página indisponível offline.', { status: 503 });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('Recurso indisponível offline.', { status: 503 });
    }
  })());
});
