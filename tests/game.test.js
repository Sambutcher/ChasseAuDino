import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelEtat, debloquerTir, finSerie, serieTerminee, voirFeu, quitterFeu, tirer, serieEntamee, CARTOUCHES } from '../js/game.js';
import { creerSuivi } from '../js/tracker.js';

const cible = { x: 0, y: 0, w: 30, h: 90 }; // boîte du feu ; plaque = marge de 4,5 autour
const haut = { x: 15, y: 15 };
const ailleurs = { x: 200, y: 200 };
const enPosition = () => debloquerTir(nouvelEtat());

test('la partie commence par la course, sans balles', () => {
  const etat = nouvelEtat();
  assert.equal(etat.phase, 'course');
  assert.equal(etat.cartouches, 0);
  assert.equal(tirer(voirFeu(etat), cible, haut).resultat, null, 'pas de tir pendant la course');
});

test('position de tir : 3 cartouches et cible vierge', () => {
  const etat = enPosition();
  assert.equal(etat.phase, 'tir');
  assert.equal(etat.cartouches, CARTOUCHES);
  assert.deepEqual(etat.touches, [false, false, false]);
  assert.deepEqual(etat.impacts, []);
});

test('pas de tir sans feu visible', () => {
  const { etat, resultat } = tirer(enPosition(), cible, haut);
  assert.equal(resultat, null);
  assert.equal(etat.cartouches, CARTOUCHES);
});

test('touché blanchit le rond et consomme une cartouche', () => {
  const { etat, resultat } = tirer(voirFeu(enPosition()), cible, haut);
  assert.equal(resultat, 'touche');
  assert.deepEqual(etat.touches, [true, false, false]);
  assert.equal(etat.cartouches, 2);
  assert.ok(serieEntamee(etat));
});

test('raté consomme une cartouche sans blanchir', () => {
  const { etat, resultat } = tirer(voirFeu(enPosition()), cible, ailleurs);
  assert.equal(resultat, 'rate');
  assert.deepEqual(etat.touches, [false, false, false]);
  assert.equal(etat.cartouches, 2);
});

test('un rond déjà blanchi compte comme raté', () => {
  const etat = tirer(voirFeu(enPosition()), cible, haut).etat;
  const r = tirer(etat, cible, haut);
  assert.equal(r.resultat, 'rate');
  assert.deepEqual(r.etat.touches, [true, false, false]);
});

test('3 cartouches maximum', () => {
  let etat = voirFeu(enPosition());
  for (let i = 0; i < 3; i++) etat = tirer(etat, cible, ailleurs).etat;
  assert.equal(etat.cartouches, 0);
  assert.equal(tirer(etat, cible, haut).resultat, null);
});

test('la série survit à la perte du feu tant qu\'il reste des balles', () => {
  let etat = tirer(voirFeu(enPosition()), cible, haut).etat;
  etat = quitterFeu(etat);
  assert.equal(etat.cibleVisible, false);
  assert.equal(etat.cartouches, 2);
  assert.deepEqual(etat.touches, [true, false, false]);
  assert.equal(tirer(etat, cible, haut).resultat, null, 'tap sans feu ignoré');
  etat = voirFeu(etat);
  assert.deepEqual(etat.touches, [true, false, false], 'ronds conservés au retour');
});

test('3 balles tirées : fin de série, retour à la course ; quitter le feu ne recharge plus', () => {
  let etat = voirFeu(enPosition());
  assert.ok(!serieTerminee(etat));
  for (let i = 0; i < 3; i++) etat = tirer(etat, cible, haut).etat;
  assert.ok(serieTerminee(etat));
  assert.equal(quitterFeu(etat).cartouches, 0, 'pas de rechargement en quittant le feu');
  etat = finSerie(etat);
  assert.equal(etat.phase, 'course');
  assert.equal(etat.cartouches, 0);
  assert.ok(!serieTerminee(etat));
  etat = debloquerTir(etat);
  assert.equal(etat.cartouches, CARTOUCHES);
  assert.deepEqual(etat.touches, [false, false, false], 'cible vierge après la course');
});

test('suivi : confirmation, position amortie ou recalée, oubli après persistance', () => {
  const s = creerSuivi({ confirmations: 2, persistanceMs: 1000 });
  s.maj({ x: 0, y: 0, w: 10, h: 30 }, 0);
  assert.equal(s.lire(0).actif, false);
  s.maj({ x: 4, y: 0, w: 10, h: 30 }, 100);
  assert.equal(s.lire(100).actif, true);
  assert.equal(s.lire(100).cible.x, 2, 'petit écart (bruit) amorti de moitié');
  s.maj({ x: 12, y: 0, w: 10, h: 30 }, 200);
  assert.equal(s.lire(200).cible.x, 12, 'écart > 25 % de la hauteur : recalage direct');
  s.maj(null, 900);
  assert.equal(s.lire(900).actif, true);
  assert.equal(s.lire(1300).actif, false);
  assert.equal(s.lire(1300).cible, null);
});

test('suivi : taille figée sous un bruit de ±8 %', () => {
  const s = creerSuivi();
  const bruit = [1, 1.08, 0.93, 1.05, 0.92, 1.07, 0.95, 1.03, 0.94, 1.08];
  bruit.forEach((f, i) => s.maj({ x: 100, y: 100, w: 20 * f, h: 60 * f }, i * 100));
  const c = s.lire(1000).cible;
  assert.equal(c.w, 20);
  assert.equal(c.h, 60);
});

test('suivi : la taille suit un vrai changement (+30 %)', () => {
  const s = creerSuivi();
  s.maj({ x: 100, y: 100, w: 20, h: 60 }, 0);
  for (let i = 1; i <= 8; i++) s.maj({ x: 97, y: 91, w: 26, h: 78 }, i * 100);
  const c = s.lire(900).cible;
  assert.ok(Math.abs(c.h - 78) < 78 * 0.03, `hauteur ${c.h} devrait rejoindre 78`);
  assert.ok(Math.abs(c.w - 26) < 26 * 0.03, `largeur ${c.w} devrait rejoindre 26`);
});

test('suivi : la cible suit le flux optique et cumule le déplacement', () => {
  const s = creerSuivi();
  s.maj({ x: 100, y: 100, w: 20, h: 60 }, 0);
  s.deplacer(5, -3);
  s.deplacer(2, 1);
  assert.deepEqual(s.lire(10).cible, { x: 107, y: 98, w: 20, h: 60 });
  assert.deepEqual(s.cumul, { x: 7, y: -2 });
});

test('suivi : un saut lointain exige 2 confirmations', () => {
  const s = creerSuivi();
  s.maj({ x: 100, y: 100, w: 20, h: 60 }, 0);
  s.maj({ x: 100, y: 100, w: 20, h: 60 }, 100);
  s.maj({ x: 300, y: 100, w: 20, h: 60 }, 200);
  assert.equal(s.lire(200).cible.x, 100, 'faux positif isolé ignoré');
  s.maj({ x: 302, y: 100, w: 20, h: 60 }, 300);
  assert.equal(s.lire(300).cible.x, 302, 'saut confirmé');
});

test('raté sur la plaque : un éclat en coordonnées relatives', () => {
  // Plaque : x -4,5 → 34,5 (w 39), y -4,5 → 94,5 (h 99). Entre deux ronds, sur le blanc.
  const { etat, resultat } = tirer(voirFeu(enPosition()), cible, { x: 15, y: 30 });
  assert.equal(resultat, 'rate');
  assert.equal(etat.impacts.length, 1);
  assert.ok(Math.abs(etat.impacts[0].u - 19.5 / 39) < 1e-9);
  assert.ok(Math.abs(etat.impacts[0].v - 34.5 / 99) < 1e-9);
});

test('raté hors plaque ou touché : pas d\'éclat', () => {
  assert.deepEqual(tirer(voirFeu(enPosition()), cible, ailleurs).etat.impacts, []);
  assert.deepEqual(tirer(voirFeu(enPosition()), cible, haut).etat.impacts, []);
});

test('éclats conservés à la perte du feu, effacés au rechargement', () => {
  let etat = tirer(voirFeu(enPosition()), cible, { x: 15, y: 30 }).etat;
  etat = voirFeu(quitterFeu(etat));
  assert.equal(etat.impacts.length, 1);
  etat = tirer(etat, cible, ailleurs).etat;
  etat = tirer(etat, cible, ailleurs).etat;
  assert.deepEqual(debloquerTir(finSerie(etat)).impacts, []);
});
