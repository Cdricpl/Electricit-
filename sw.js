/* Décompte — service worker
   La version vient du paramètre ?v= de l'URL d'enregistrement.
   Changer APP_VERSION dans app.js suffit : nouvelle URL => nouveau SW
   => nouveau cache => les anciens sont supprimés automatiquement. */

const PARAMS  = new URL(self.location).searchParams;
const VERSION = PARAMS.get("v") || "dev";
const PAGE    = PARAMS.get("p") || "./";
const CACHE   = "decompte-" + VERSION;

// Les icônes et le manifeste ne changent pas d'une version à l'autre.
const ASSETS = ["manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
                "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
const SHELL  = [PAGE, "app.js?v=" + VERSION, ...ASSETS];

const isAsset = path => path.includes("/icons/") || path.endsWith("manifest.webmanifest");

// Installation : on précharge la coquille, en forçant le réseau
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: "reload" })))))
      .catch(() => {})            // hors ligne à l'install : on n'échoue pas
      .then(() => self.skipWaiting())
  );
});

// Activation : purge de tous les caches d'autres versions
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith("decompte-") && k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function cacheIfOk(req, resp, key) {
  if (resp && resp.status === 200 && resp.type === "basic") {
    const copy = resp.clone();
    caches.open(CACHE).then(c => c.put(key || req, copy));
  }
  return resp;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Icônes et manifeste : cache d'abord, ils ne bougent pas.
  if (isAsset(url.pathname)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req)
        .then(resp => cacheIfOk(req, resp))
        .catch(() => new Response("", { status: 504, statusText: "Hors ligne" })))
    );
    return;
  }

  // Tout le reste — la page et son script — porte le code de l'application,
  // donc réseau d'abord. Les servir depuis le cache figerait le téléphone sur
  // sa version installée : le script périmé réenregistrerait le même service
  // worker, qui reservirait le même script, indéfiniment.
  const nav = req.mode === "navigate";
  const key = nav ? PAGE : undefined;
  e.respondWith(
    fetch(req)
      .then(resp => cacheIfOk(req, resp, key))
      .catch(() => caches.match(key || req, { ignoreSearch: true })
        .then(hit => hit || (nav ? caches.match(PAGE) : null)
          || new Response("", { status: 504, statusText: "Hors ligne" })))
  );
});

// Purge manuelle déclenchée depuis la page
self.addEventListener("message", e => {
  if (e.data === "purge") {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
