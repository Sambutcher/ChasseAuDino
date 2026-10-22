import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceM, creerCourse } from '../js/course.js';

const PARIS = { lat: 48.8566, lon: 2.3522 };
// Position à `nord` mètres au nord et `est` mètres à l'est de PARIS.
const decale = (nord, est = 0) => ({
  lat: PARIS.lat + nord / 111195,
  lon: PARIS.lon + est / (111195 * Math.cos((PARIS.lat * Math.PI) / 180)),
});
const fix = (nord, t, precision = 5, est = 0) => ({ ...decale(nord, est), precision, t });

test('distanceM : distances connues', () => {
  assert.ok(Math.abs(distanceM(PARIS, decale(100)) - 100) < 0.5);
  assert.ok(Math.abs(distanceM(PARIS, decale(0, 100)) - 100) < 0.5);
  assert.ok(Math.abs(distanceM(PARIS, decale(60, 80)) - 100) < 0.5);
  // Paris → Lyon ≈ 392 km
  assert.ok(Math.abs(distanceM(PARIS, { lat: 45.764, lon: 4.8357 }) - 392000) < 2000);
});

test('arrêt tant que la course n\'est pas lancée', () => {
  const c = creerCourse();
  c.ajouter(fix(0, 0));
  assert.equal(c.etat().phase, 'arret');
});

test('départ = meilleure position récente', () => {
  const c = creerCourse();
  c.ajouter(fix(0, 0, 20));
  c.ajouter(fix(10, 1000, 4)); // la plus précise
  c.ajouter(fix(20, 2000, 12));
  c.demarrer(2500);
  c.ajouter(fix(60, 20000));
  assert.equal(c.etat().phase, 'course');
  assert.ok(Math.abs(c.etat().distance - 50) < 0.5, 'mesuré depuis la position à 10 m');
});

test('sans position récente : attente du GPS puis départ à la prochaine précise', () => {
  const c = creerCourse();
  c.ajouter(fix(0, 0));
  c.demarrer(20000); // position trop ancienne
  assert.equal(c.etat().phase, 'gps');
  c.ajouter(fix(5, 20500, 50)); // imprécise : ignorée
  assert.equal(c.etat().phase, 'gps');
  assert.equal(c.etat().precision, 50, 'précision affichée même si imprécise');
  c.ajouter(fix(5, 21000, 8));
  assert.equal(c.etat().phase, 'course');
  assert.equal(c.etat().distance, 0);
});

test('99 m ne suffisent pas, déblocage dès la première position à 100 m, rebloqué en deçà', () => {
  const c = creerCourse();
  c.ajouter(fix(0, 0));
  c.demarrer(0);
  for (let i = 1; i <= 33; i++) c.ajouter(fix(i * 3, i * 1000)); // 3 m/s jusqu'à 99 m
  assert.equal(c.etat().phase, 'course');
  c.ajouter(fix(101, 34000));
  assert.equal(c.etat().phase, 'fini', 'vert sans attendre une deuxième position');
  c.ajouter(fix(108, 36000));
  assert.ok(c.etat().distance > 100, 'distance non plafonnée');
  c.ajouter(fix(85, 41000));
  assert.equal(c.etat().phase, 'course', 'revenir sous 100 m rebloque le tir');
  assert.ok(Math.abs(c.etat().distance - 85) < 0.5);
  c.ajouter(fix(104, 47000));
  assert.equal(c.etat().phase, 'fini');
});

test('saut aberrant du GPS ignoré (vitesse impossible à pied)', () => {
  const c = creerCourse();
  c.ajouter(fix(0, 0));
  c.demarrer(0);
  c.ajouter(fix(30, 10000));
  c.ajouter(fix(140, 11000)); // 110 m en 1 s
  assert.equal(c.etat().phase, 'course');
  assert.ok(Math.abs(c.etat().distance - 30) < 0.5);
  c.ajouter(fix(40, 12000)); // la course reprend normalement
  assert.ok(Math.abs(c.etat().distance - 40) < 0.5);
});

test('positions imprécises ignorées pendant la course', () => {
  const c = creerCourse();
  c.ajouter(fix(0, 0));
  c.demarrer(0);
  c.ajouter(fix(150, 1000, 40));
  c.ajouter(fix(150, 2000, 40));
  assert.equal(c.etat().phase, 'course');
  assert.equal(c.etat().distance, 0);
});

test('à vol d\'oiseau : un aller-retour ne compte pas', () => {
  const c = creerCourse();
  c.ajouter(fix(0, 0));
  c.demarrer(0);
  for (let i = 1; i <= 20; i++) c.ajouter(fix(i * 3, i * 1000)); // aller : 60 m
  for (let i = 1; i <= 20; i++) c.ajouter(fix(60 - i * 3, 20000 + i * 1000)); // retour
  assert.equal(c.etat().phase, 'course');
  assert.ok(c.etat().distance < 1, `${c.etat().distance} m : on est revenu au départ`);
});

test('nouveau départ : remise à zéro', () => {
  const c = creerCourse();
  c.ajouter(fix(0, 0));
  c.demarrer(0);
  c.ajouter(fix(110, 40000));
  c.ajouter(fix(112, 41000));
  assert.equal(c.etat().phase, 'fini');
  c.demarrer(41500);
  assert.equal(c.etat().phase, 'course');
  assert.equal(c.etat().distance, 0);
  c.ajouter(fix(150, 54000));
  assert.ok(Math.abs(c.etat().distance - 38) < 0.5, 'depuis la position à 112 m');
});
