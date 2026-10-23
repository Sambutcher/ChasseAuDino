import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES_POSE, classePose, decoderPose, inclinaisonTete, teteBaissee, orientation, combiner, estimationStable, lacetDe, zonePose, versZone } from '../js/posture.js';
import { ESPECES } from '../js/especes.js';

// Points clés d'un animal : seuls les indices donnés sont surs (x, y).
const NEZ = 2, GORGE = 17, QUEUE = 19, OEIL_G = 0, OEIL_D = 1, PATTE_AR = 15;
function pose(surs, h = 100) {
  const points = Array.from({ length: 20 }, () => ({ x: 0, y: 0, c: 0 }));
  for (const [k, x, y = 50] of surs) points[k] = { x, y, c: 0.9 };
  return { points, h, classe: 0 };
}

test('classes de pose : chaque classe COCO existe dans le bestiaire', () => {
  const classes = new Set(Object.values(ESPECES).map((e) => e.classe));
  for (const c of CLASSES_POSE) assert.ok(classes.has(c), `classe ${c}`);
  assert.equal(classePose(19), 4);
  assert.equal(classePose(2), -1);
});

test('décodage : meilleure détection de la classe, 20 points rangés par ancre', () => {
  const n = 3;
  const d = new Float32Array((4 + 5 + 60) * n);
  const mettre = (canal, i, v) => { d[canal * n + i] = v; };
  for (const [i, score] of [[0, 0.5], [2, 0.9]]) {
    mettre(0, i, 100 + i); mettre(1, i, 120); mettre(2, i, 60); mettre(3, i, 80);
    mettre(4 + 1, i, score); // classe 1 (chat)
    mettre(9 + 3 * NEZ, i, 130 + i); mettre(10 + 3 * NEZ, i, 90); mettre(11 + 3 * NEZ, i, 0.8);
  }
  const det = decoderPose(d, n, 1);
  assert.ok(Math.abs(det.score - 0.9) < 1e-6);
  assert.deepEqual([det.x, det.y, det.w, det.h], [102 - 30, 120 - 40, 60, 80]);
  assert.deepEqual([det.points[NEZ].x, det.points[NEZ].y], [132, 90]);
  assert.ok(Math.abs(det.points[NEZ].c - 0.8) < 1e-6);
  assert.equal(decoderPose(d, n, 0), null, 'rien pour une autre classe');
});

test('orientation : de profil vers la droite et vers la gauche', () => {
  const droite = orientation(pose([[NEZ, 160], [QUEUE, 40]]));
  assert.equal(droite.sens, 1);
  assert.ok(droite.profil > 0.9 && !droite.dos);
  const gauche = orientation(pose([[NEZ, 40], [GORGE, 55], [PATTE_AR, 150]]));
  assert.equal(gauche.sens, -1);
  assert.ok(gauche.profil > 0.7);
});

test('orientation : de face, peu de profil ; yeux croisés, de dos', () => {
  const face = orientation(pose([[NEZ, 52], [QUEUE, 48], [OEIL_G, 60], [OEIL_D, 40]]));
  assert.ok(face.profil < 0.1 && !face.dos);
  const dos = orientation(pose([[GORGE, 50], [QUEUE, 48], [OEIL_G, 40], [OEIL_D, 60]]));
  assert.ok(dos.profil < 0.1 && dos.dos);
  const profil = orientation(pose([[NEZ, 170], [QUEUE, 40], [OEIL_G, 40], [OEIL_D, 60]]));
  assert.ok(!profil.dos, 'de profil, l\'ordre des yeux ne dit rien');
});

test('orientation : sans tête ou sans arrière surs, inconnue', () => {
  assert.equal(orientation(pose([[NEZ, 100]])), null);
  assert.equal(orientation(pose([[QUEUE, 100]])), null);
});

test('combiner : moyenne du profil, vote du sens et du dos', () => {
  const o = combiner([{ profil: 0.2, sens: 1, dos: false }, { profil: 0.6, sens: -1, dos: false }, { profil: 1, sens: 1, dos: true }, null]);
  assert.ok(Math.abs(o.profil - 0.6) < 1e-9);
  assert.equal(o.sens, 1);
  assert.equal(o.dos, false);
  assert.equal(combiner([null, null]), null);
});

test('lacet : face 0, profil ±π/2 selon le sens, dos π', () => {
  assert.equal(lacetDe({ profil: 0, sens: 1, dos: false }), 0);
  assert.ok(Math.abs(lacetDe({ profil: 1, sens: 1, dos: false }) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(lacetDe({ profil: 1, sens: -1, dos: false }) + Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(lacetDe({ profil: 0, sens: 1, dos: true }) - Math.PI) < 1e-9);
  assert.ok(Math.abs(lacetDe({ profil: 1, sens: 1, dos: true }) - Math.PI / 2) < 1e-9);
});

test('zone de pose : carré autour de la cible avec marge, borné à l\'écran', () => {
  const z = zonePose({ x: 100, y: 200, w: 80, h: 120 }, 400, 800);
  assert.equal(z.w, z.h);
  assert.ok(Math.abs(z.w - 150) < 1e-9);
  assert.ok(Math.abs(z.x + z.w / 2 - 140) < 1e-9 && Math.abs(z.y + z.h / 2 - 260) < 1e-9);
  const bord = zonePose({ x: 0, y: 0, w: 50, h: 50 }, 400, 800);
  assert.ok(bord.x >= 0 && bord.y >= 0);
  const grand = zonePose({ x: 0, y: 0, w: 900, h: 900 }, 400, 800);
  assert.equal(grand.w, 400);
});

test('versZone : de l\'entrée carrée vers l\'écran', () => {
  const b = versZone({ x: 64, y: 128, w: 128, h: 64 }, { x: 10, y: 20, w: 512, h: 512 }, 256);
  assert.deepEqual(b, { x: 138, y: 276, w: 256, h: 128 });
});

test('estimation stable : trois estimations concordantes seulement', () => {
  const o = (profil, sens = 1, dos = false) => ({ profil, sens, dos });
  assert.ok(estimationStable([o(0.8), o(0.85), o(0.9)]));
  assert.ok(!estimationStable([o(0.8), o(0.85)]), 'pas assez d\'estimations');
  assert.ok(!estimationStable([o(0.8), null, o(0.9)]), 'une estimation manquante');
  assert.ok(!estimationStable([o(0.8), o(0.8, -1), o(0.8)]), 'sens différent');
  assert.ok(!estimationStable([o(0.2), o(0.5), o(0.8)]), 'profil qui change');
  assert.ok(!estimationStable([o(0.1), o(0.1, 1, true), o(0.1)]), 'dos différent');
});

const GARROT = 18;
test('inclinaison de la tête : levée, dans le prolongement, baissée, quel que soit le sens', () => {
  const profil = { profil: 1, sens: 1 };
  const droite = (nezY) => inclinaisonTete(pose([[QUEUE, 20, 50], [GARROT, 100, 50], [NEZ, 150, nezY]]), profil);
  assert.ok(Math.abs(droite(50)) < 0.01, 'dans le prolongement du dos');
  assert.ok(droite(20) < -0.4, 'levée');
  assert.ok(droite(110) > 0.8, 'baissée');
  const gauche = inclinaisonTete(pose([[QUEUE, 180, 50], [GARROT, 100, 50], [NEZ, 50, 110]]), { profil: 1, sens: -1 });
  assert.ok(Math.abs(gauche - droite(110)) < 0.01, 'symétrique');
  assert.ok(inclinaisonTete(pose([[QUEUE, 20], [GARROT, 100], [NEZ, 150, 110]]), { profil: 0.3, sens: 1 }) === null, 'pas de profil');
  assert.equal(inclinaisonTete(pose([[QUEUE, 20], [NEZ, 150, 110]]), profil), null, 'garrot manquant');
});

test('tête baissée : hystérésis et inconnue sans mesures', () => {
  assert.equal(teteBaissee([1, 1, 1], false), true);
  assert.equal(teteBaissee([0.6, 0.6, 0.6], false), false, 'sous le seuil pour baisser');
  assert.equal(teteBaissee([0.6, 0.6, 0.6], true), true, 'au-dessus du seuil pour relever');
  assert.equal(teteBaissee([0.2, 0.3, 0.2], true), false);
  assert.equal(teteBaissee([null, 1.2, null], false), false, 'trop peu de mesures : état conservé');
  assert.equal(teteBaissee([null, null, null], true), true);
});
