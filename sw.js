/* Décompte — service worker
   La version vient du paramètre ?v= de l'URL d'enregistrement.
   Changer APP_VERSION dans index.html suffit : nouvelle URL => nouveau SW
   => nouveau cache => les anciens sont supprimés automatiquement. */

const PARAMS = new URL(self.location).searchParams;
const VERSION = PARAMS.get("v") || "dev";
const PAGE    = PARAMS.get("p") || "./";
const CACHE   = "decompte-" + VERSION;

const SHELL = [PAGE, "app.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
               "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];

// Installation : on précharge la coquille, en forçant le réseau
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(
        SHELL.map(u => c.add(new Request(u, { cache: "reload" })))
      ))
      .catch(() => {})            // hors ligne à l'install : on n'échoue pas
      .then(() => self.skipWaiting())
  );
});

// Activation : purge de tous les caches d'autres versions
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith("decompte-") && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // La page elle-même : réseau d'abord, cache en secours.
  // C'est elle qui porte APP_VERSION — la servir depuis le cache figerait
  // l'application sur sa version installée, sans jamais voir les mises à jour.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then(resp => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(PAGE, copy));
        }
        return resp;
      }).catch(() => caches.match(PAGE).then(hit => hit || caches.match("./")))
    );
    return;
  }

  // Le reste (icônes, manifeste) : cache d'abord, réseau en secours
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(resp => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      }).catch(() => new Response("", { status: 504, statusText: "Hors ligne" }));
    })
  );
});

// Purge manuelle déclenchée depuis la page
self.addEventListener("message", e => {
  if (e.data === "purge") {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
