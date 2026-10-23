// Posture des animaux : décodage de la sortie de yolo11n-pose (Animal Pose, 20 points clés) et
// orientation de l'animal (de face, de profil, de dos) à en déduire. Logique pure, sans navigateur.
//
// Sortie du modèle [1, 4 + 5 + 60, n] : cx, cy, w, h, 5 scores de classe, puis 20 × (x, y, confiance),
// pour n ancres, en pixels de l'entrée (carré découpé autour de l'animal).

// Classes du modèle de pose (ordre de tools/preparer_pose.py) → classe COCO du jeu.
export const CLASSES_POSE = [16, 15, 18, 17, 19]; // chien, chat, mouton, cheval, vache
export const classePose = (classeCoco) => CLASSES_POSE.indexOf(classeCoco);

// Indices des points clés utiles (ordre du jeu de données).
const OEIL_G = 0;
const OEIL_D = 1;
const NEZ = 2;
const GORGE = 17;
const QUEUE = 19;
const TETE = [NEZ, GORGE]; // devant du corps
const ARRIERE = [QUEUE, 7, 8, 11, 12, 15, 16]; // queue, coudes, genoux et pattes arrière

const NB_POINTS = 20;
const SEUIL_SCORE = 0.3;
const SEUIL_POINT = 0.4;
// Longueur du corps vue de profil, en hauteurs de la boîte (98ᵉ centile mesuré sur Animal Pose).
const CORPS_PROFIL = [1.17, 1.18, 1.19, 1.12, 1.44];

// Meilleure détection de la classe voulue (indice de classe du modèle de pose), ou null.
export function decoderPose(donnees, n, classe, seuil = SEUIL_SCORE) {
  let meilleur = null;
  for (let i = 0; i < n; i++) {
    const score = donnees[(4 + classe) * n + i];
    if (score < seuil || (meilleur && score <= meilleur.score)) continue;
    const w = donnees[2 * n + i];
    const h = donnees[3 * n + i];
    const points = [];
    for (let k = 0; k < NB_POINTS; k++) {
      const base = 9 + 3 * k;
      points.push({ x: donnees[base * n + i], y: donnees[(base + 1) * n + i], c: donnees[(base + 2) * n + i] });
    }
    meilleur = { x: donnees[i] - w / 2, y: donnees[n + i] - h / 2, w, h, score, classe, points };
  }
  return meilleur;
}

// Moyenne en x des points surs de la liste, ou null.
function moyenneX(points, indices) {
  const surs = indices.map((k) => points[k]).filter((p) => p.c >= SEUIL_POINT);
  return surs.length ? surs.reduce((s, p) => s + p.x, 0) / surs.length : null;
}

// Orientation d'une détection de pose : { profil, sens, dos } ou null si les points manquent.
// profil : 0 (de face ou de dos) à 1 (de profil) ; sens : +1 s'il regarde vers la droite de
// l'image, -1 vers la gauche ; dos : on le voit par l'arrière.
export function orientation(detection) {
  const { points, h, classe } = detection;
  const devant = moyenneX(points, TETE);
  const derriere = moyenneX(points, ARRIERE);
  if (devant === null || derriere === null) return null;
  const ecart = devant - derriere;
  const profil = Math.min(1, Math.abs(ecart) / (h * CORPS_PROFIL[classe]));
  // De face, l'œil gauche de l'animal est à droite de l'image ; de dos, c'est l'inverse.
  const g = points[OEIL_G];
  const d = points[OEIL_D];
  const dos = profil < 0.5 && g.c >= SEUIL_POINT && d.c >= SEUIL_POINT && g.x < d.x;
  return { profil, sens: ecart >= 0 ? 1 : -1, dos };
}

// Moyenne des dernières orientations : profil moyen, sens et dos par vote majoritaire.
export function combiner(historique) {
  const vues = historique.filter(Boolean);
  if (!vues.length) return null;
  const vote = (valeur) => vues.filter(valeur).length * 2 > vues.length;
  return {
    profil: vues.reduce((s, o) => s + o.profil, 0) / vues.length,
    sens: vote((o) => o.sens > 0) ? 1 : -1,
    dos: vote((o) => o.dos),
  };
}

// Angle de rotation du modèle autour de la verticale (avant du modèle = +Z, positif vers la
// droite de l'image) : de face 0, de profil ±π/2, de dos π.
export function lacetDe({ profil, sens, dos }) {
  const profilage = profil * Math.PI / 2;
  return sens * (dos ? Math.PI - profilage : profilage);
}

// Carré de l'écran à faire analyser autour d'une cible (marge de 25 %), borné à l'écran.
export function zonePose(cible, ecranW, ecranH) {
  const cote = Math.min(Math.max(cible.w, cible.h) * 1.25, ecranW, ecranH);
  const x = Math.min(Math.max(cible.x + cible.w / 2 - cote / 2, 0), ecranW - cote);
  const y = Math.min(Math.max(cible.y + cible.h / 2 - cote / 2, 0), ecranH - cote);
  return { x, y, w: cote, h: cote };
}

// Boîte d'une détection de pose (pixels de l'entrée carrée de côté `entree`) ramenée à l'écran.
export function versZone(detection, zone, entree) {
  const k = zone.w / entree;
  return { x: zone.x + detection.x * k, y: zone.y + detection.y * k, w: detection.w * k, h: detection.h * k };
}
