// Posture des animaux avec RTMPose-m (AP-10K, 17 points clés), export TensorFlow.js.
// Interface : chargerPosture(url) puis estimer(source, decoupe) → 17 points {x, y, score} dans le
// repère de la découpe (0–taille). `tf` est le global chargé par vendor/tf.min.js.
// decoderSimcc, sortiesSimcc et orientation sont purs (testés sous Node).

// Points clés AP-10K, dans l'ordre des sorties du modèle.
export const POINTS = [
  'oeilG', 'oeilD', 'nez', 'cou', 'queue', 'epauleG', 'coudeG', 'patteAvG', 'epauleD', 'coudeD',
  'patteAvD', 'hancheG', 'genouG', 'patteArG', 'hancheD', 'genouD', 'patteArD',
];
const I = Object.fromEntries(POINTS.map((p, i) => [p, i]));
const MOYENNE = [123.675, 116.28, 103.53];
const ECART = [58.395, 57.12, 57.375];
const DIVISION_SIMCC = 2; // 2 cases SimCC par pixel d'entrée
export const AGRANDISSEMENT = 1.25; // marge autour du rectangle de l'animal, comme MMPose
export const SEUIL_POINT = 0.3;

let modele = null;
let taille = 256;

export async function chargerPosture(url) {
  modele = await tf.loadGraphModel(url);
  taille = modele.inputs[0].shape[1];
  // Première inférence à vide : compile les shaders WebGL avant la partie.
  tf.tidy(() => modele.execute(tf.zeros([1, taille, taille, 3])));
  return { taille };
}

// Découpe carrée centrée sur le rectangle de l'animal, agrandie de la marge MMPose.
export function decoupeCarree(boite) {
  const cote = Math.max(boite.w, boite.h) * AGRANDISSEMENT;
  return { x: boite.x + boite.w / 2 - cote / 2, y: boite.y + boite.h / 2 - cote / 2, w: cote, h: cote };
}

// canvas : la découpe déjà dessinée à la taille d'entrée du modèle.
export async function estimer(canvas) {
  const sorties = tf.tidy(() => {
    const image = tf.browser.fromPixels(canvas).toFloat().sub(MOYENNE).div(ECART).expandDims(0);
    return modele.execute(image);
  });
  const [sx, sy] = sortiesSimcc(modele, sorties);
  const n = sx.shape[2];
  const [dx, dy] = await Promise.all([sx.data(), sy.data()]);
  tf.dispose(sorties);
  return decoderSimcc(dx, dy, POINTS.length, n);
}

export const tailleEntree = () => taille;

// Sorties [x, y] reconnues à leur nom (simcc_x, simcc_y), sinon dans l'ordre du modèle.
export function sortiesSimcc(m, sorties) {
  const noms = m.outputs.map((o) => o.name);
  const ix = noms.findIndex((n) => /simcc_x/.test(n));
  const iy = noms.findIndex((n) => /simcc_y/.test(n));
  return ix >= 0 && iy >= 0 ? [sorties[ix], sorties[iy]] : sorties;
}

// SimCC : pour chaque point, une distribution sur n cases en x et en y ; position = case du
// maximum / DIVISION_SIMCC, confiance = le plus petit des deux maxima.
export function decoderSimcc(dx, dy, nPoints, n) {
  const points = [];
  for (let k = 0; k < nPoints; k++) {
    const [ax, mx] = argmax(dx, k * n, n);
    const [ay, my] = argmax(dy, k * n, n);
    points.push({ x: ax / DIVISION_SIMCC, y: ay / DIVISION_SIMCC, score: Math.min(mx, my) });
  }
  return points;
}

function argmax(t, debut, n) {
  let im = 0;
  let m = -Infinity;
  for (let i = 0; i < n; i++) {
    if (t[debut + i] > m) {
      m = t[debut + i];
      im = i;
    }
  }
  return [im, m];
}

// Orientation de l'animal d'après ses points clés (repère quelconque, `largeur` = largeur du
// rectangle de l'animal dans ce repère) :
// sens : −1 regarde à gauche, +1 à droite, 0 inconnu ; profil : 0 face (ou dos) → 1 profil ;
// fiable : la tête ou l'arrière-train ont été trouvés.
export function orientation(points, largeur, seuil = SEUIL_POINT) {
  const sur = (nom) => (points[I[nom]].score >= seuil ? points[I[nom]] : null);
  const milieu = (a, b) => (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null);
  const yeux = [sur('oeilG'), sur('oeilD')];
  const tete = sur('nez') ?? milieu(...yeux) ?? yeux[0] ?? yeux[1] ?? sur('cou');
  const arriere = sur('queue') ?? milieu(sur('hancheG'), sur('hancheD')) ?? sur('hancheG') ?? sur('hancheD');
  if (!tete && !arriere) return { sens: 0, profil: 0, fiable: false };
  if (!tete || !arriere) return { sens: 0, profil: 0, fiable: true }; // de face ou de dos

  const dx = tete.x - arriere.x;
  let profil = Math.min(1, Math.abs(dx) / (0.6 * largeur));
  // Deux yeux nettement écartés : l'animal regarde l'objectif.
  if (yeux[0] && yeux[1] && Math.abs(yeux[0].x - yeux[1].x) > 0.08 * largeur) profil = Math.min(profil, 0.35);
  const sens = Math.abs(dx) > 0.1 * largeur ? Math.sign(dx) : 0;
  return { sens, profil, fiable: true };
}

// Orientation retenue d'après les dernières estimations fiables (la plus récente en dernier) :
// profil moyen ; sens majoritaire parmi celles qui en donnent un, le plus récent à égalité.
export function combiner(historique) {
  if (!historique.length) return null;
  const profil = historique.reduce((s, o) => s + o.profil, 0) / historique.length;
  const somme = historique.reduce((s, o) => s + o.sens, 0);
  const recent = [...historique].reverse().find((o) => o.sens)?.sens ?? 0;
  return { sens: Math.sign(somme) || recent, profil };
}
