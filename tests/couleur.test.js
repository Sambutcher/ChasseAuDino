import { test } from 'node:test';
import assert from 'node:assert/strict';
import { couleurPixel, couleurVoiture, majorite, zoneCarrosserie } from '../js/couleur.js';

// Échantillon RGBA : [nombre, [r, g, b]] répétés.
function echantillon(...parts) {
  const px = [];
  for (const [n, rgb] of parts) for (let i = 0; i < n; i++) px.push(...rgb, 255);
  return new Uint8ClampedArray(px);
}

test('couleurPixel : nuances et neutres', () => {
  assert.equal(couleurPixel(200, 20, 30), 'rouge');
  assert.equal(couleurPixel(230, 120, 20), 'orange');
  assert.equal(couleurPixel(230, 210, 30), 'jaune');
  assert.equal(couleurPixel(30, 160, 60), 'vert');
  assert.equal(couleurPixel(20, 60, 200), 'bleu');
  assert.equal(couleurPixel(120, 40, 170), 'violet');
  assert.equal(couleurPixel(240, 240, 238), 'blanc');
  assert.equal(couleurPixel(130, 132, 135), 'gris');
  assert.equal(couleurPixel(25, 25, 30), 'noir');
  assert.equal(couleurPixel(40, 5, 5), 'noir', 'rouge trop sombre pour juger');
  assert.equal(couleurPixel(110, 60, 25), 'orange', 'marron = orange sombre');
});

test('couleurVoiture : nuance dès 30 % de pixels colorés, malgré reflets et vitres', () => {
  assert.equal(couleurVoiture(echantillon([40, [190, 25, 30]], [60, [140, 140, 145]])), 'rouge');
  assert.equal(couleurVoiture(echantillon([35, [25, 70, 190]], [40, [245, 245, 245]], [25, [20, 20, 20]])), 'bleu');
});

test('couleurVoiture : sinon le neutre majoritaire', () => {
  assert.equal(couleurVoiture(echantillon([70, [240, 240, 240]], [20, [120, 120, 120]], [10, [200, 30, 30]])), 'blanc');
  assert.equal(couleurVoiture(echantillon([80, [20, 20, 22]], [20, [150, 150, 150]])), 'noir');
  assert.equal(couleurVoiture(echantillon([90, [150, 152, 155]], [10, [30, 90, 200]])), 'gris');
  assert.equal(couleurVoiture(new Uint8ClampedArray(0)), 'gris');
});

test('majorite et zone de carrosserie', () => {
  assert.equal(majorite(['bleu', 'gris', 'bleu', 'noir', 'bleu']), 'bleu');
  assert.equal(majorite([]), null);
  assert.deepEqual(zoneCarrosserie({ x: 0, y: 0, w: 100, h: 50 }), { x: 20, y: 25, w: 60, h: 15 });
});
