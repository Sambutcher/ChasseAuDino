import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerSuivi } from '../js/tracker.js';

test('prolonger : sans détection, la cible reste valable tant qu\'on la prolonge', () => {
  const s = creerSuivi();
  const boite = { x: 100, y: 100, w: 50, h: 50, classe: 17 };
  s.maj(boite, 0); s.maj(boite, 100);
  for (let t = 200; t < 3000; t += 100) { s.prolonger(t); assert.ok(s.lire(t).actif); }
  assert.equal(s.lire(5000).actif, false);
});
