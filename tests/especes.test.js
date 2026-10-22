import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESPECES, CLASSES, PERSONNAGES_VOITURE, especeDe, estVoiture, trouverClip, filtrerEspece, messageIssue,
} from '../js/especes.js';
import { decoder } from '../js/detector.js';

// Noms des animations d'un .glb (JSON du premier bloc du binaire glTF).
function clipsDu(fichier) {
  const b = readFileSync(new URL(`../${fichier}`, import.meta.url));
  const n = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + n).toString('utf8')).animations.map((a) => a.name);
}

test('cibles : voiture et les 5 animaux COCO', () => {
  assert.deepEqual(CLASSES, [2, 15, 16, 17, 18, 19]);
  const animaux = ['chat', 'chien', 'cheval', 'mouton', 'vache'];
  assert.deepEqual(animaux.map((a) => ESPECES[a].nom), ['lapin', 'loup', 'licorne', 'dragon', 'dinosaure']);
  assert.deepEqual(animaux.map((a) => ESPECES[a].ton), ['kawaii', 'mechant', 'kawaii', 'mechant', 'kawaii']);
});

test('especeDe : animal par sa classe, voiture par sa couleur', () => {
  assert.equal(especeDe(19), 'vache');
  assert.equal(especeDe(15), 'chat');
  assert.equal(especeDe(2, 'bleu'), 'mage');
  assert.equal(especeDe(2, 'rouge'), 'squelette-mage');
  assert.equal(especeDe(2, null), 'chevalier', 'couleur inconnue : gris');
  assert.equal(especeDe(0), null);
  assert.ok(estVoiture(2) && !estVoiture(16));
});

test('chaque couleur de voiture mène à un personnage existant, héros kawaii ou squelette méchant', () => {
  for (const [couleur, cle] of Object.entries(PERSONNAGES_VOITURE)) {
    const e = ESPECES[cle];
    assert.ok(e, `${couleur} → ${cle} absent`);
    assert.equal(e.classe, 2);
    assert.equal(e.ton, cle.startsWith('squelette') ? 'mechant' : 'kawaii');
  }
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

test('filtrerEspece : toutes les boîtes, ou celles de la classe verrouillée', () => {
  const boites = [{ classe: 15 }, { classe: 19 }];
  assert.equal(filtrerEspece(boites, null), boites);
  assert.deepEqual(filtrerEspece(boites, 19), [{ classe: 19 }]);
});

test('messageIssue accorde le genre', () => {
  assert.equal(messageIssue(ESPECES.cheval, 'enfuie'), 'La licorne s\'est enfuie !');
  assert.equal(messageIssue(ESPECES.mouton, 'enfuie'), 'Le dragon s\'est enfui !');
  assert.equal(messageIssue(ESPECES.barbare, 'explosee'), 'Le barbare a explosé !');
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
