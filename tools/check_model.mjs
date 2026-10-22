// Vérifie le modèle TF.js exporté avec le décodage du jeu (js/detector.js).
// Usage (Node + @tensorflow/tfjs-node) : node tools/check_model.mjs models/yolo11n image.jpg
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import tf from '@tensorflow/tfjs-node';
import { decoder } from '../js/detector.js';
import { letterbox } from '../js/geometry.js';
import { ESPECES } from '../js/especes.js';

const [dossier, cheminImage] = process.argv.slice(2);
const modele = await tf.loadGraphModel(pathToFileURL(resolve(dossier, 'model.json')).href);
const [, H, W] = modele.inputs[0].shape;

const image = tf.node.decodeImage(await readFile(cheminImage), 3);
const [h, w] = image.shape;
const lb = letterbox(w, h, W, H);
const entree = tf.tidy(() => {
  const redim = tf.image.resizeBilinear(image, [Math.round(lb.dh), Math.round(lb.dw)]);
  const haut = Math.round(lb.dy);
  const gauche = Math.round(lb.dx);
  return redim
    .pad([[haut, H - haut - redim.shape[0]], [gauche, W - gauche - redim.shape[1]], [0, 0]], 114)
    .toFloat().div(255).expandDims(0);
});
const sortie = modele.execute(entree);
const [, , n] = sortie.shape;
const donnees = await sortie.data();
console.log(`entrée ${W}×${H}, sortie ${sortie.shape}`);

let total = 0;
for (const b of decoder(donnees, n)) {
  total++;
  const e = ESPECES[b.classe];
  console.log(`${e.animal} → ${e.nom} ${b.score.toFixed(2)} x=${b.x.toFixed(0)} y=${b.y.toFixed(0)} w=${b.w.toFixed(0)} h=${b.h.toFixed(0)}`);
}
if (total === 0) {
  console.error('Aucune détection : export ou décodage incorrect.');
  process.exit(1);
}
