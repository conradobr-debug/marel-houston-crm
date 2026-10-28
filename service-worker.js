const CACHE_NAME = "marel-houston-shell-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./partners.js",
  "./manifest.webmanifest",
  "./assets/marel/logo-reversed.png",
  "./assets/marel/app-icon-192.png",
  "./assets/marel/app-icon-512.png",
  "./config/company-config.js",
  "./config/branding-config.js",
  "./config/theme-config.js",
  "./config/locale-config.js",
  "./config/pipeline-config.js",
  "./config/lead-classification-config.js",
  "./config/partner-classification-config.js",
  "./config/field-config.js",
  "./config/integrations-config.js",
  "./config/measurement-config.js",
  "./js/config-loader.js",
  "./js/data/crm-mappers.js",
  "./js/data/mock-crm-repository.js",
  "./js/data/supabase-crm-repository.js",
  "./js/data/crm-repository-contract.js",
  "./js/data/crm-data-service.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if(event.request.mode === "navigate"){
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if(url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if(response.ok){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
