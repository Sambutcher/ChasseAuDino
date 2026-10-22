// Service worker : tout le jeu est mis en cache à l'installation pour jouer hors ligne.
// Changer VERSION à chaque mise en ligne (et dans index.html, vérifié par tests/pwa.test.js),
// sinon les téléphones gardent l'ancienne version.
const VERSION = '1.1.4';
const CACHE = `chasse-au-dino-${VERSION}`;

const FICHIERS = [
  './',
  'index.html',
  'style.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'vendor/tf.min.js',
  'vendor/three.module.min.js',
  'vendor/GLTFLoader.js',
  'vendor/BufferGeometryUtils.js',
  'js/main.js',
  'js/camera.js',
  'js/detector.js',
  'js/game.js',
  'js/geometry.js',
  'js/render.js',
  'js/tracker.js',
  'js/flow.js',
  'js/course.js',
  'js/position.js',
  'js/especes.js',
  'js/creatures.js',
  'js/sons.js',
  'js/couleur.js',
  'models/yolo11n/model.json',
  'models/yolo11n/group1-shard1of3.bin',
  'models/yolo11n/group1-shard2of3.bin',
  'models/yolo11n/group1-shard3of3.bin',
  'models/creatures/dino.glb',
  'models/creatures/licorne.glb',
  'models/creatures/loup.glb',
  'models/creatures/dragon.glb',
  'models/creatures/lapin.glb',
  'models/creatures/chevalier.glb',
  'models/creatures/barbare.glb',
  'models/creatures/mage.glb',
  'models/creatures/voleur.glb',
  'models/creatures/voleur-capuche.glb',
  'models/creatures/squelette-mage.glb',
  'models/creatures/squelette-guerrier.glb',
  'models/creatures/squelette-voleur.glb',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    caches.match(ev.request, { ignoreSearch: true }).then((r) => r || fetch(ev.request)),
  );
});
