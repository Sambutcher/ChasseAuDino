import { test } from 'node:test';
import assert from 'node:assert/strict';
import { versGris, estimerDecalage } from '../js/flow.js';

const L = 120;
const H = 200;

// Motif texturé déterministe, décalé de (dx, dy) : la valeur en (x, y) vient de (x - dx, y - dy).
function motif(dx = 0, dy = 0) {
  const img = new Uint8Array(L * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < L; x++) {
      const u = x - dx;
      const v = y - dy;
      img[y * L + x] = (Math.sin(u * 0.7) * 60 + Math.cos(v * 0.45 + u * 0.13) * 60 + ((u * 7 + v * 13) % 23) * 3 + 128) & 255;
    }
  }
  return img;
}

const zone = { x: 40, y: 60, w: 30, h: 70 };

test('aucun mouvement', () => {
  const a = motif();
  assert.deepEqual(estimerDecalage(a, a, L, H, zone), { dx: 0, dy: 0, fiable: true });
});

for (const [dx, dy] of [[3, 0], [-5, 2], [7, -9], [-12, 12], [1, -1]]) {
  test(`décalage (${dx}, ${dy}) retrouvé`, () => {
    const r = estimerDecalage(motif(), motif(dx, dy), L, H, zone);
    assert.deepEqual(r, { dx, dy, fiable: true });
  });
}

test('gros bloc échantillonné (zone centrale)', () => {
  const r = estimerDecalage(motif(), motif(-4, 6), L, H, { x: 30, y: 50, w: 60, h: 100 });
  assert.deepEqual(r, { dx: -4, dy: 6, fiable: true });
});

test('zone au bord : bornée, sans lecture hors image', () => {
  const r = estimerDecalage(motif(), motif(2, 3), L, H, { x: -20, y: -20, w: 50, h: 60 });
  assert.deepEqual(r, { dx: 2, dy: 3, fiable: true });
});

test('bloc uni : non fiable', () => {
  const uni = new Uint8Array(L * H).fill(90);
  assert.equal(estimerDecalage(uni, uni, L, H, zone).fiable, false);
});

test('versGris', () => {
  assert.deepEqual([...versGris(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]))], [255, 0]);
});
