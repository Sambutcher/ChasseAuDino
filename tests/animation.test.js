import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pose, creerAnimation, DUREE_HUMEUR, VARIANTES_HUMEUR } from '../js/animation.js';

const ETATS = [['attente', 0], ['humeur', 0], ['humeur', 1], ['fuite', 0]];

test('poses bornées : jamais sous le sol, écrasement et inclinaison modestes', () => {
  for (const [etat, variante] of ETATS) {
    for (let t = 0; t <= 3; t += 0.01) {
      const p = pose(etat, t, variante);
      assert.ok(p.dy >= 0 && p.dy < 0.3, `${etat} dy ${p.dy}`);
      assert.ok(p.sy > 0.85 && p.sy < 1.15 && p.sx > 0.85 && p.sx < 1.15, `${etat} échelle`);
      assert.ok(Math.abs(p.roulis) < 0.3 && Math.abs(p.tangage) < 0.2, `${etat} inclinaison`);
    }
  }
});

test('la pose d\'attente et celle de fin de mimique repartent du neutre', () => {
  const neutre = { dy: 0, sx: 1, sy: 1, roulis: 0, tangage: 0 };
  for (const v of [0, 1]) {
    for (const t of [0, DUREE_HUMEUR]) {
      const p = pose('humeur', t, v);
      for (const k of Object.keys(neutre)) assert.ok(Math.abs(p[k] - neutre[k]) < 1e-9, `variante ${v}, t ${t}, ${k}`);
    }
  }
  assert.deepEqual(pose('attente', 0), neutre);
});

test('la mimique saute vraiment, la fuite sautille', () => {
  const haut = Math.max(...Array.from({ length: 90 }, (_, i) => pose('humeur', i / 100, 0).dy));
  assert.ok(haut > 0.15);
  const fuite = Array.from({ length: 100 }, (_, i) => pose('fuite', i / 100).dy);
  assert.ok(Math.max(...fuite) > 0.1 && Math.min(...fuite) < 0.01);
});

test('automate : une mimique terminée revient seule à l\'attente', () => {
  const a = creerAnimation();
  assert.equal(a.etat, 'attente');
  a.humeur(5); // variante hors bornes : ramenée dans [0, VARIANTES_HUMEUR[
  assert.equal(a.etat, 'humeur');
  a.maj(DUREE_HUMEUR / 2);
  assert.equal(a.etat, 'humeur');
  a.maj(DUREE_HUMEUR);
  assert.equal(a.etat, 'attente');
  a.fuite();
  a.maj(10);
  assert.equal(a.etat, 'fuite', 'la fuite dure jusqu\'à ce qu\'on l\'arrête');
  assert.equal(VARIANTES_HUMEUR, 2);
});
