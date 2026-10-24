'use strict';
// SHADOW Phase 245: conservative offline shell cache. No network calls or telemetry.
const CACHE_PREFIX = 'shadow-phase245-shell-';
const CACHE_NAME = CACHE_PREFIX + '14';
const SHELL = ['./index.html', './style.css', './lite.css', './lite-boot.js', './hologram.js', './wake.js', './errlog.js', './storage.js', './script.js','./microphone.js', './shadow-ai.js', './local-llm.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL.map(u => new Request(u, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match('./index.html')) || new Response('SHADOW offline shell unavailable. Reconnect and reload.', {status: 503, headers: {'Content-Type':'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try { return await fetch(request); }
    catch (_) { return new Response('', {status: 504}); }
  })());
});
