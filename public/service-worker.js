const CACHE_NAME = "budget-static-cache-v1"
const DATA_CACHE_NAME = "budget-data-cache-v1"

const FILES_TO_CACHE = [
    "/",
    "/index.html",
    "index.js",
    "styles.css",
    "/manifest.webmanifest",
    "icons/icon-192x192.png",
    "icons/icon-512x512.png",
];


// install
self.addEventListener("install", function(evt) {
    // pre cache all static assets
    evt.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Your files were pre-cached successfully!")
            return cache.addAll(FILES_TO_CACHE)
        })
    );

    self.skipWaiting();
});

// drop caches if they don't match the cache names we use
self.addEventListener("activate", function(evt) {
    evt.waitUntil(
        caches.keys().then(keyList => {
            return Promise.all(
                keyList.map(key => {
                    if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
                        console.log("Removing old cache data", key);
                        return caches.delete(key)
                    }
                })
            )
        })
    )

    self.clients.claim();
})

// fetch
self.addEventListener("fetch", function(evt) {
    // cache successful requests to the API
    if (evt.request.url.includes("/api/")) {
        evt.respondWith(
            caches.open(DATA_CACHE_NAME).then(cache => {
                return fetch(evt.request)
                .then(response => {
                    // if the response was good, clone it and store it in the "budget-data-cache-v1"
                    if (response.status === 200) {
                        cache.put(evt.request.url, response.clone());
                    }
                    
                    return response;
                })
                .catch(err => {
                    // Network request failed, get it from the cache
                    return cache.match(evt.request);
                });
            }).catch(err => console.log(err))
        );

        return;
    }

    // "offline-first" approach 
    evt.respondWith(
        caches.match(evt.request).then(function(response) {
            return response || fetch(evt.request)
        })
    )
})
