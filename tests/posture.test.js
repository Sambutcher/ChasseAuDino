import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POINTS, decoderSimcc, sortiesSimcc, orientation, combiner, decoupeCarree } from '../js/posture.js';

// 17 points AP-10K, tous invisibles sauf ceux donnés ({ nom: [x, y] }).
function points(visibles) {
  return POINTS.map((nom) => (visibles[nom] ? { x: visibles[nom][0], y: visibles[nom][1], score: 0.9 } : { x: 0, y: 0, score: 0.05 }));
}

test('decoderSimcc : maximum de chaque distribution / 2, confiance = plus petit maximum', () => {
  const n = 8;
  const dx = new Float32Array(2 * n);
  const dy = new Float32Array(2 * n);
  dx[5] = 0.9; dy[2] = 0.7; // point 0 : case x 5, y 2
  dx[n + 1] = 0.4; dy[n + 7] = 0.8; // point 1 : case x 1, y 7
  assert.deepEqual(decoderSimcc(dx, dy, 2, n).map((p) => [p.x, p.y, Math.round(p.score * 10) / 10]),
    [[2.5, 1, 0.7], [0.5, 3.5, 0.4]]);
});

test('sortiesSimcc : sorties reconnues à leur nom, sinon dans l\'ordre', () => {
  const m = { outputs: [{ name: 'simcc_y' }, { name: 'simcc_x' }] };
  assert.deepEqual(sortiesSimcc(m, ['Y', 'X']), ['X', 'Y']);
  assert.deepEqual(sortiesSimcc({ outputs: [{ name: 'output_1' }, { name: 'output_0' }] }, ['Y', 'X']), ['X', 'Y']);
  assert.deepEqual(sortiesSimcc({ outputs: [{ name: 'Identity' }, { name: 'Identity_1' }] }, ['A', 'B']), ['A', 'B']);
});

test('orientation : chien de profil regardant à gauche, puis à droite', () => {
  // Rectangle de 200 de large : nez à gauche, queue à droite.
  const gauche = orientation(points({ nez: [20, 50], oeilG: [35, 40], cou: [60, 60], queue: [190, 70] }), 200);
  assert.deepEqual([gauche.sens, gauche.profil, gauche.fiable], [-1, 1, true]);
  const droite = orientation(points({ nez: [180, 50], queue: [10, 70], hancheG: [30, 80] }), 200);
  assert.equal(droite.sens, 1);
});

test('orientation : face (deux yeux écartés), dos (queue sans tête), rien de sûr', () => {
  const face = orientation(points({ nez: [100, 60], oeilG: [80, 40], oeilD: [120, 40], queue: [105, 90] }), 100);
  assert.equal(face.sens, 0);
  assert.ok(face.profil < 0.4);
  const troisQuarts = orientation(points({ nez: [70, 60], oeilG: [60, 40], oeilD: [80, 40], queue: [20, 80] }), 100);
  assert.equal(troisQuarts.sens, 1);
  assert.ok(troisQuarts.profil > 0.7, 'deux yeux visibles mais tête loin de la queue : de profil');
  const presqueFace = orientation(points({ nez: [60, 60], oeilG: [45, 40], oeilD: [70, 40], queue: [45, 80] }), 100);
  assert.ok(presqueFace.profil <= 0.35, 'deux yeux écartés, tête au-dessus de la queue : de face');
  assert.deepEqual(orientation(points({ queue: [50, 50] }), 100), { sens: 0, profil: 0, fiable: true });
  assert.deepEqual(orientation(points({}), 100), { sens: 0, profil: 0, fiable: false });
});

test('orientation sur les points réels de RTMPose (dalmatien de profil, tourné vers la droite)', () => {
  // Sortie du modèle converti sur tools/chien.jpg (models/rtmpose-reference, workflow export-posture).
  const reels = [[152, 84], [137, 83], [150, 96], [124, 96], [60, 92], [131, 119], [142, 140], [151, 162],
    [104, 118], [126, 128], [131, 147], [78, 135], [54, 148], [45, 170], [52, 118], [32, 138], [21, 158]]
    .map(([x, y]) => ({ x, y, score: 0.9 }));
  const o = orientation(reels, 140); // chien d'environ 140 px de large dans l'entrée 256×256
  assert.deepEqual([o.sens, o.profil, o.fiable], [1, 1, true]);
});

test('combiner : profil moyen, sens majoritaire, le plus récent à égalité', () => {
  assert.equal(combiner([]), null);
  const o = combiner([{ sens: 1, profil: 1 }, { sens: 1, profil: 0.5 }, { sens: -1, profil: 0.9 }]);
  assert.equal(o.sens, 1);
  assert.ok(Math.abs(o.profil - 0.8) < 1e-9);
  assert.equal(combiner([{ sens: 1, profil: 1 }, { sens: -1, profil: 1 }]).sens, -1);
  assert.equal(combiner([{ sens: 0, profil: 0 }]).sens, 0);
});

test('decoupeCarree : carré centré sur le rectangle, agrandi de 25 %', () => {
  assert.deepEqual(decoupeCarree({ x: 100, y: 50, w: 80, h: 40 }), { x: 90, y: 20, w: 100, h: 100 });
});
