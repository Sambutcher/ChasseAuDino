// Vérifie le modèle de posture TF.js contre la référence ONNX Runtime (tools/reference_posture.py)
// avec le décodage du jeu (js/posture.js). Usage (Node + @tensorflow/tfjs-node) :
// node tools/check_posture.mjs models/rtmpose-ap10k models/rtmpose-reference
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import tf from '@tensorflow/tfjs-node';
import { decoderSimcc, sortiesSimcc } from '../js/posture.js';

const [dossier, dossierRef] = process.argv.slice(2);
const modele = await tf.loadGraphModel(pathToFileURL(resolve(dossier, 'model.json')).href);
console.log('entrée', modele.inputs.map((i) => `${i.name} ${i.shape}`), 'sorties', modele.outputs.map((o) => o.name));

const ref = JSON.parse(await readFile(resolve(dossierRef, 'reference.json'), 'utf8')).points;
const brut = await readFile(resolve(dossierRef, 'entree.bin'));
const entree = tf.tensor(new Float32Array(brut.buffer, brut.byteOffset, brut.length / 4), [1, 256, 256, 3]);
const sorties = modele.execute(entree);
const [sx, sy] = sortiesSimcc(modele, sorties);
const n = sx.shape[2];
const points = decoderSimcc(await sx.data(), await sy.data(), 17, n);

let ecart = 0;
points.forEach((p, i) => {
  if (ref[i].score > 0.3) ecart = Math.max(ecart, Math.abs(p.x - ref[i].x), Math.abs(p.y - ref[i].y));
});
console.log('points TF.js', points.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)} ${p.score.toFixed(2)}`).join(' | '));
console.log(`écart max TF.js ↔ ONNX : ${ecart} px`);
if (ecart > 3) {
  console.error('Conversion TF.js incorrecte.');
  process.exit(1);
}
