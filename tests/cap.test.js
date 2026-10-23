import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decoupeCarree, rectanglesDecoupe, lisserProbas, lacetDeProbas, lacetAliment, capStable, MARGE } from '../js/cap.js';

const un = (k, n = 8) => Array.from({ length: n }, (_, i) => (i === k ? 1 : 0));
const proche = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('découpe : carré centré, côté = plus grand côté × marge', () => {
  const d = decoupeCarree({ x: 100, y: 200, w: 80, h: 40 });
  proche(d.cote, 80 * MARGE);
  proche(d.x + d.cote / 2, 140);
  proche(d.y + d.cote / 2, 220);
});

test('découpe : la partie hors de l\'écran reste grise, entièrement dehors → null', () => {
  const r = rectanglesDecoupe({ x: -50, y: 0, cote: 100 }, 400, 800, 128);
  assert.deepEqual(r.source, { x: 0, y: 0, w: 50, h: 100 });
  proche(r.dest.x, 64);
  proche(r.dest.w, 64);
  assert.equal(rectanglesDecoupe({ x: 500, y: 0, cote: 100 }, 400, 800), null);
});

test('lissage : première mesure reprise telle quelle, puis moyenne glissante', () => {
  assert.deepEqual(lisserProbas(null, [1, 0]), [1, 0]);
  const l = lisserProbas([1, 0], [0, 1], 0.4);
  proche(l[0], 0.6);
  proche(l[1], 0.4);
});

test('lacet : de face 0, profil à gauche/droite ±π/2, de dos π', () => {
  proche(lacetDeProbas(un(0)), 0);
  proche(lacetDeProbas(un(2)), -Math.PI / 2); // azimut 90° : avant à gauche de l'image
  proche(lacetDeProbas(un(6)), Math.PI / 2); // azimut 270° : avant à droite
  proche(Math.abs(lacetDeProbas(un(4))), Math.PI);
});

test('lacet : deux secteurs voisins donnent l\'angle entre eux, même au passage de 0', () => {
  const p = un(0).map((_, i) => (i === 0 || i === 7 ? 0.5 : 0));
  proche(lacetDeProbas(p), Math.PI / 8); // entre 0° et 315° (= −45° d'azimut → +45° de lacet)
});

test('aliment : voiture de profil avant à droite → aliment de face (flanc), de face → de côté', () => {
  proche(lacetAliment(un(6)), 0);
  proche(lacetAliment(un(0)), -Math.PI / 2);
  proche(Math.abs(lacetAliment(un(2))), Math.PI);
});

test('cap stable : trois secteurs identiques de suite', () => {
  assert.equal(capStable([2, 2]), false);
  assert.equal(capStable([2, 3, 2]), false);
  assert.equal(capStable([2, 2, 2]), true);
});
