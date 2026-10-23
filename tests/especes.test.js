import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESPECES, CLASSES, ALIMENTS_VOITURE, especeDe, estVoiture, filtrerEspece, messageIssue,
} from '../js/especes.js';
import { decoder } from '../js/detector.js';

// Noms des animations d'un .glb (JSON du premier bloc du binaire glTF).
function clipsDu(fichier) {
  const b = readFileSync(new URL(`../${fichier}`, import.meta.url));
  const n = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + n).toString('utf8')).animations?.map((a) => a.name) ?? [];
}

test('cibles : voiture et les 5 animaux COCO', () => {
  assert.deepEqual(CLASSES, [2, 15, 16, 17, 18, 19]);
  const animaux = ['chat', 'chien', 'cheval', 'mouton', 'vache'];
  assert.deepEqual(animaux.map((a) => ESPECES[a].nom), ['chaton', 'chiot', 'licorne', 'panda', 'dragon']);
  assert.deepEqual(animaux.map((a) => ESPECES[a].ton), ['kawaii', 'kawaii', 'kawaii', 'kawaii', 'kawaii']);
});

test('especeDe : animal par sa classe, voiture par sa couleur', () => {
  assert.equal(especeDe(19), 'vache');
  assert.equal(especeDe(15), 'chat');
  assert.equal(especeDe(2, 'bleu'), 'sushi');
  assert.equal(especeDe(2, 'rouge'), 'burger');
  assert.equal(especeDe(2, null), 'frites', 'couleur inconnue : gris');
  assert.equal(especeDe(0), null);
  assert.ok(estVoiture(2) && !estVoiture(16));
});

test('chaque couleur de voiture mène à un aliment existant ; chaque aliment a sa couleur', () => {
  for (const [couleur, cle] of Object.entries(ALIMENTS_VOITURE)) {
    assert.ok(ESPECES[cle], `${couleur} → ${cle} absent`);
    assert.equal(ESPECES[cle].classe, 2);
  }
  const aliments = Object.keys(ESPECES).filter((c) => ESPECES[c].classe === 2);
  assert.deepEqual([...new Set(Object.values(ALIMENTS_VOITURE))].sort(), aliments.sort());
});

test('les modèles sont statiques : aucune animation dans les .glb', () => {
  for (const e of Object.values(ESPECES)) assert.deepEqual(clipsDu(e.fichier), [], `${e.nom} : animée en code`);
});

test('filtrerEspece : toutes les boîtes, ou celles de la classe verrouillée', () => {
  const boites = [{ classe: 15 }, { classe: 19 }];
  assert.equal(filtrerEspece(boites, null), boites);
  assert.deepEqual(filtrerEspece(boites, 19), [{ classe: 19 }]);
});

test('messageIssue accorde le genre', () => {
  assert.equal(messageIssue(ESPECES.cheval, 'enfuie'), 'La licorne s\'est enfuie !');
  assert.equal(messageIssue(ESPECES.mouton, 'enfuie'), 'Le panda s\'est enfui !');
  assert.equal(messageIssue(ESPECES.burger, 'explosee'), 'Le burger a explosé !');
  assert.equal(messageIssue(ESPECES.frites, 'enfuie'), 'La barquette de frites s\'est enfuie !');
});

test('decoder : meilleure classe recherchée par ancre, seuil et NMS', () => {
  const n = 4;
  const d = new Float32Array(84 * n);
  const ancre = (i, cx, cy, w, h, scores) => {
    d[i] = cx; d[n + i] = cy; d[2 * n + i] = w; d[3 * n + i] = h;
    for (const [c, s] of Object.entries(scores)) d[(4 + Number(c)) * n + i] = s;
  };
  ancre(0, 50, 50, 20, 20, { 15: 0.4, 16: 0.8 }); // chien plutôt que chat
  ancre(1, 51, 50, 20, 20, { 19: 0.6 }); // recouvre l'ancre 0 : supprimée par la NMS
  ancre(2, 150, 50, 20, 20, { 9: 0.99, 18: 0.2 }); // feu ignoré, mouton sous le seuil
  ancre(3, 250, 50, 40, 20, { 2: 0.7 }); // voiture
  const boites = decoder(d, n);
  assert.deepEqual(boites.map((b) => b.classe), [16, 2]);
  assert.ok(Math.abs(boites[0].score - 0.8) < 1e-6);
  assert.deepEqual([boites[0].x, boites[0].y, boites[0].w, boites[0].h], [40, 40, 20, 20]);
});
