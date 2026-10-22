import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cadrage, letterbox, versEcran, plusProcheDe, zoneDetection, lisserVers, placementVideo } from '../js/geometry.js';

test('cadrage couvre l\'écran puis zoome au centre', () => {
  // Vidéo portrait 720×1280 sur écran 375×667 : même ratio ≈, zoom 2 → moitié centrale.
  const c = cadrage(720, 1280, 360, 640, 2);
  assert.deepEqual(c, { sx: 180, sy: 320, sw: 360, sh: 640 });
  // Vidéo paysage sur écran portrait : on rogne les côtés.
  const p = cadrage(1280, 720, 360, 640, 1);
  assert.equal(p.sh, 720);
  assert.equal(p.sw, 405);
  assert.equal(p.sx, (1280 - 405) / 2);
});

test('letterbox et retour en coordonnées écran', () => {
  const lb = letterbox(360, 640, 320, 320);
  assert.deepEqual(lb, { dx: 70, dy: 0, dw: 180, dh: 320 });
  const e = versEcran({ x: 70, y: 0, w: 180, h: 320 }, lb, 360, 640);
  assert.deepEqual(e, { x: 0, y: 0, w: 360, h: 640 });
});

test('plusProcheDe choisit la boîte la plus centrée', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };
  const b = { x: 45, y: 45, w: 10, h: 10 };
  assert.equal(plusProcheDe([a, b], { x: 50, y: 50 }), b);
  assert.equal(plusProcheDe([], { x: 0, y: 0 }), null);
});

test('zoneDetection : autour de la cible, au ratio du modèle, bornée à l\'écran', () => {
  const ratio = 224 / 384;
  const z = zoneDetection({ x: 180, y: 300, w: 15, h: 40 }, 375, 667, ratio, 0);
  assert.equal(z.type, 'cible');
  assert.ok(Math.abs(z.w / z.h - ratio) < 1e-9);
  assert.equal(z.h, 667 / 4, 'hauteur minimale : quart de l\'écran');
  assert.ok(Math.abs(z.x + z.w / 2 - 187.5) < 1e-9 && Math.abs(z.y + z.h / 2 - 320) < 1e-9, 'centrée sur la cible');
  const bord = zoneDetection({ x: 0, y: 0, w: 30, h: 80 }, 375, 667, ratio, 0);
  assert.equal(bord.x, 0);
  assert.equal(bord.y, 0);
  assert.equal(bord.h, 320);
  const geante = zoneDetection({ x: 100, y: 100, w: 100, h: 400 }, 375, 667, ratio, 0);
  assert.ok(geante.w <= 375 && geante.h <= 667);
});

test('zoneDetection : sans cible, alternance vue entière / centre', () => {
  const ratio = 224 / 384;
  assert.deepEqual(zoneDetection(null, 375, 667, ratio, 0), { x: 0, y: 0, w: 375, h: 667, type: 'vue' });
  const c = zoneDetection(null, 375, 667, ratio, 1);
  assert.equal(c.type, 'centre');
  assert.equal(c.h, 333.5);
  assert.ok(Math.abs(c.x + c.w / 2 - 187.5) < 1e-9);
});

test('aller-retour zone écran → entrée modèle → écran', () => {
  const zone = zoneDetection({ x: 200, y: 250, w: 12, h: 30 }, 375, 667, 224 / 384, 0);
  const lb = letterbox(zone.w, zone.h, 224, 384);
  // Une boîte occupant toute l'image placée dans l'entrée revient exactement sur la zone.
  const e = versEcran({ x: lb.dx, y: lb.dy, w: lb.dw, h: lb.dh }, lb, zone.w, zone.h);
  for (const [a, b] of [[e.x, 0], [e.y, 0], [e.w, zone.w], [e.h, zone.h]]) assert.ok(Math.abs(a - b) < 1e-9);
});

test('placementVideo : la zone voulue de l\'écran tombe exactement sur la cible', () => {
  // Vidéo 720×1280 sur écran 360×640, zoom 2 : la moitié centrale de la vidéo remplit l'écran.
  const c = cadrage(720, 1280, 360, 640, 2);
  const ecran = { x: 0, y: 0, w: 360, h: 640 };
  // Écran entier : vidéo de 720×1280 points, décalée de la moitié de l'écran.
  assert.deepEqual(placementVideo(c, 720, 1280, 360, 640, ecran, ecran), { x: -180, y: -320, w: 720, h: 1280 });
  // Zone 90×160 au centre de l'écran vers un canvas 45×80 (moitié) : échelle 0,5.
  const p = placementVideo(c, 720, 1280, 360, 640, { x: 135, y: 240, w: 90, h: 160 }, { x: 0, y: 0, w: 45, h: 80 });
  assert.deepEqual(p, { x: (-180 - 135) / 2, y: (-320 - 240) / 2, w: 360, h: 640 });
  // Le pixel vidéo du centre de la zone (360, 640) tombe au centre de la cible (22,5 ; 40).
  assert.equal(p.x + (360 / 720) * p.w, 22.5);
  assert.equal(p.y + (640 / 1280) * p.h, 40);
  // Cible décalée (letterbox) : simple translation.
  const q = placementVideo(c, 720, 1280, 360, 640, ecran, { x: 10, y: 20, w: 360, h: 640 });
  assert.deepEqual([q.x, q.y], [-170, -300]);
});

test('lisserVers : indépendant de la cadence, 63 % de l\'écart au bout de tau', () => {
  assert.ok(Math.abs(lisserVers(0, 100, 0.1, 0.1) - 63.2) < 0.1);
  let v = 0;
  for (let i = 0; i < 6; i++) v = lisserVers(v, 100, 1 / 60, 0.1); // 6 images à 60 i/s
  let w = 0;
  for (let i = 0; i < 3; i++) w = lisserVers(w, 100, 1 / 30, 0.1); // 3 images à 30 i/s
  assert.ok(Math.abs(v - w) < 1e-9);
  assert.equal(lisserVers(42, 100, 0, 0.1), 42);
});
