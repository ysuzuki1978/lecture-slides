// Service Worker
//   アプリ本体：事前キャッシュ（版を上げると入れ替わる）
//   一覧・スライド定義（*.json）：ネットワーク優先、失敗したらキャッシュ
//   スライド画像：キャッシュ優先（「オフライン用に保存」で deck-* キャッシュに入る）
const APP = "app-v1";
const SHELL = [
  "./", "index.html", "viewer.html", "app.css", "catalog.js", "viewer.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png",
  "decks.json", // 初回訪問時はまだ SW の管理下にないので、一覧はここで確保する（以後はネットワーク優先で更新）
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("app-") && k !== APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  try {
    const res = await fetch(req, { cache: "no-cache" });
    if (res.ok) (await caches.open(APP)).put(req, res.clone());
    return res;
  } catch (_) {
    const hit = await caches.match(req, { ignoreSearch: false });
    if (hit) return hit;
    throw _;
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  return fetch(req);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (u.pathname.endsWith(".json")) {
    e.respondWith(networkFirst(req));
  } else if (/\.(webp|png|jpg)$/.test(u.pathname) && u.pathname.includes("/decks/")) {
    e.respondWith(cacheFirst(req));
  } else if (req.mode === "navigate") {
    // viewer.html?id=... のようなクエリ付きでも本体を返す
    e.respondWith(fetch(req).catch(() => caches.match(u.pathname.endsWith("viewer.html") ? "viewer.html" : "index.html")));
  } else {
    e.respondWith(cacheFirst(req));
  }
});
