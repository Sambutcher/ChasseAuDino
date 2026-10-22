import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESPECES, CLASSES, trouverClip, filtrerEspece, messageIssue } from '../js/especes.js';
import { decoder } from '../js/detector.js';

// Noms des animations d'un .glb (JSON du premier bloc du binaire glTF).
function clipsDu(fichier) {
  const b = readFileSync(new URL(`../${fichier}`, import.meta.url));
  const n = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + n).toString('utf8')).animations.map((a) => a.name);
}

test('les 5 animaux COCO : chat, chien, cheval, mouton, vache', () => {
  assert.deepEqual(CLASSES, [15, 16, 17, 18, 19]);
  assert.deepEqual(CLASSES.map((c) => ESPECES[c].nom), ['lapin', 'loup', 'licorne', 'dragon', 'dinosaure']);
  assert.deepEqual(CLASSES.map((c) => ESPECES[c].ton), ['kawaii', 'mechant', 'kawaii', 'mechant', 'kawaii']);
});

test('chaque créature a ses animations dans son modèle', () => {
  for (const e of Object.values(ESPECES)) {
    const noms = clipsDu(e.fichier);
    for (const clip of [e.clips.attente, e.clips.fuite, ...e.clips.humeurs]) {
      assert.ok(trouverClip(noms, clip), `${e.nom} : animation ${clip} absente`);
    }
  }
});

test('trouverClip : nom exact puis suffixe après « | »', () => {
  const noms = ['CharacterArmature|Idle', 'Gallop_Jump', 'AnimalArmature|Gallop', 'Gallop'];
  assert.equal(trouverClip(noms, 'Idle'), 'CharacterArmature|Idle');
  assert.equal(trouverClip(noms, 'Gallop'), 'Gallop');
  assert.equal(trouverClip(noms, 'Jump'), null);
});

test('filtrerEspece : toutes les boîtes, ou celles de l\'espèce verrouillée', () => {
  const boites = [{ classe: 15 }, { classe: 19 }];
  assert.equal(filtrerEspece(boites, null), boites);
  assert.deepEqual(filtrerEspece(boites, 19), [{ classe: 19 }]);
});

test('messageIssue accorde le genre', () => {
  assert.equal(messageIssue(ESPECES[17], 'enfuie'), 'La licorne s\'est enfuie !');
  assert.equal(messageIssue(ESPECES[18], 'enfuie'), 'Le dragon s\'est enfui !');
  assert.equal(messageIssue(ESPECES[19], 'explosee'), 'Le dinosaure a explosé !');
});

test('decoder : meilleure classe animale par ancre, seuil et NMS', () => {
  const n = 3;
  const d = new Float32Array(84 * n);
  const ancre = (i, cx, cy, w, h, scores) => {
    d[i] = cx; d[n + i] = cy; d[2 * n + i] = w; d[3 * n + i] = h;
    for (const [c, s] of Object.entries(scores)) d[(4 + Number(c)) * n + i] = s;
  };
  ancre(0, 50, 50, 20, 20, { 15: 0.4, 16: 0.8 }); // chien plutôt que chat
  ancre(1, 51, 50, 20, 20, { 19: 0.6 }); // recouvre l'ancre 0 : supprimée par la NMS
  ancre(2, 150, 50, 20, 20, { 9: 0.99, 18: 0.2 }); // feu ignoré, mouton sous le seuil
  const boites = decoder(d, n);
  assert.equal(boites.length, 1);
  assert.equal(boites[0].classe, 16);
  assert.ok(Math.abs(boites[0].score - 0.8) < 1e-6);
  assert.deepEqual([boites[0].x, boites[0].y, boites[0].w, boites[0].h], [40, 40, 20, 20]);
});
