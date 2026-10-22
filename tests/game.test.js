import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nouvelEtat, debloquerTir, finSerie, serieTerminee, voirCreature, quitterCreature, tirer, CARTOUCHES } from '../js/game.js';
import { creerSuivi } from '../js/tracker.js';

const VACHE = 'vache';
const CHIEN = 'chien';
const enPosition = () => debloquerTir(nouvelEtat());

test('la partie commence par la course, sans balle', () => {
  const etat = nouvelEtat();
  assert.equal(etat.phase, 'course');
  assert.equal(etat.cartouches, 0);
  assert.equal(tirer(voirCreature(etat, VACHE), true).resultat, null, 'pas de tir pendant la course');
});

test('position de tir : une seule cartouche, aucune créature', () => {
  const etat = enPosition();
  assert.equal(CARTOUCHES, 1);
  assert.equal(etat.phase, 'tir');
  assert.equal(etat.cartouches, 1);
  assert.equal(etat.espece, null);
  assert.equal(etat.issue, null);
});

test('pas de tir sans créature visible', () => {
  const { etat, resultat } = tirer(enPosition(), true);
  assert.equal(resultat, null);
  assert.equal(etat.cartouches, 1);
});

test('touchée, la créature explose ; ratée, elle s\'enfuit ; la série est finie', () => {
  const touche = tirer(voirCreature(enPosition(), VACHE), true);
  assert.equal(touche.resultat, 'touche');
  assert.equal(touche.etat.issue, 'explosee');
  assert.ok(serieTerminee(touche.etat));

  const rate = tirer(voirCreature(enPosition(), VACHE), false);
  assert.equal(rate.resultat, 'rate');
  assert.equal(rate.etat.issue, 'enfuie');
  assert.ok(serieTerminee(rate.etat));
  assert.equal(tirer(rate.etat, true).resultat, null, 'plus de cartouche');
});

test('l\'espèce est verrouillée tant que l\'animal reste en vue', () => {
  let etat = voirCreature(enPosition(), VACHE);
  assert.equal(etat.espece, VACHE);
  etat = voirCreature(etat, CHIEN);
  assert.equal(etat.espece, VACHE, 'pas de changement de créature en cours de visée');
  etat = quitterCreature(etat);
  assert.equal(etat.espece, null, 'animal perdu avant le tir : espèce libérée');
  assert.equal(voirCreature(etat, CHIEN).espece, CHIEN);
});

test('après le tir, l\'espèce reste pour l\'animation même si l\'animal est perdu', () => {
  let etat = tirer(voirCreature(enPosition(), CHIEN), false).etat;
  etat = quitterCreature(etat);
  assert.equal(etat.espece, CHIEN);
  etat = voirCreature(etat, VACHE);
  assert.equal(etat.espece, CHIEN);
});

test('fin de série : retour à la course, rechargement au pas de tir suivant', () => {
  let etat = tirer(voirCreature(enPosition(), VACHE), true).etat;
  etat = finSerie(etat);
  assert.equal(etat.phase, 'course');
  assert.equal(etat.cartouches, 0);
  assert.equal(etat.espece, null);
  assert.equal(etat.issue, null);
  assert.ok(!serieTerminee(etat));
  etat = debloquerTir(etat);
  assert.equal(etat.cartouches, 1);
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

test('suivi : l\'espèce de la première vue est conservée', () => {
  const s = creerSuivi();
  s.maj({ x: 100, y: 100, w: 20, h: 60, classe: VACHE }, 0);
  s.maj({ x: 102, y: 100, w: 20, h: 60, classe: CHIEN }, 100);
  assert.equal(s.lire(100).cible.classe, VACHE);
});
