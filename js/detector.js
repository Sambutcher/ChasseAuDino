// Détection des feux tricolores avec YOLO11n (export TensorFlow.js).
// Interface : chargerDetecteur(url) puis detecter(canvas) → boîtes {x, y, w, h, score}
// dans le repère de l'entrée du modèle. `tf` est le global chargé par vendor/tf.min.js.

const CLASSE_FEU = 9; // « traffic light » dans COCO
const SEUIL_SCORE = 0.25;
const SEUIL_IOU = 0.45;

let modele = null;

export async function chargerDetecteur(url) {
  await tf.setBackend('webgl');
  await tf.ready();
  modele = await tf.loadGraphModel(url);
  const [, hauteur, largeur] = modele.inputs[0].shape;
  // Première inférence à vide : compile les shaders WebGL avant la partie.
  tf.tidy(() => modele.execute(tf.zeros([1, hauteur, largeur, 3])));
  return { largeur, hauteur };
}

export async function detecter(canvas) {
  const sortie = tf.tidy(() => {
    const image = tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0);
    return modele.execute(image);
  });
  const [, , n] = sortie.shape;
  const donnees = await sortie.data();
  sortie.dispose();
  return decoder(donnees, n);
}

// Sortie YOLO [1, 84, n] : cx, cy, w, h puis 80 scores de classe, pour n ancres.
export function decoder(donnees, n, classe = CLASSE_FEU, seuil = SEUIL_SCORE) {
  const boites = [];
  for (let i = 0; i < n; i++) {
    const score = donnees[(4 + classe) * n + i];
    if (score < seuil) continue;
    const w = donnees[2 * n + i];
    const h = donnees[3 * n + i];
    boites.push({ x: donnees[i] - w / 2, y: donnees[n + i] - h / 2, w, h, score });
  }
  return nms(boites);
}

function nms(boites) {
  boites.sort((a, b) => b.score - a.score);
  const gardees = [];
  for (const b of boites) {
    if (gardees.every((g) => iou(g, b) < SEUIL_IOU)) gardees.push(b);
  }
  return gardees;
}

function iou(a, b) {
  const l = Math.max(a.x, b.x);
  const t = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const d = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, r - l) * Math.max(0, d - t);
  return inter / (a.w * a.h + b.w * b.h - inter);
}
