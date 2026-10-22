// Posture des animaux avec RTMPose-m (AP-10K, 17 points clés), dans ONNX Runtime Web
// (WebAssembly, processeur) exécuté par un Web Worker (js/posture-worker.js).
// Interface : chargerPosture(url) puis estimer(canvas) → 17 points {x, y, score} dans le repère
// de la découpe (0–TAILLE). versNchw, decoderSimcc et orientation sont purs (testés sous Node).

// Points clés AP-10K, dans l'ordre des sorties du modèle.
export const POINTS = [
  'oeilG', 'oeilD', 'nez', 'cou', 'queue', 'epauleG', 'coudeG', 'patteAvG', 'epauleD', 'coudeD',
  'patteAvD', 'hancheG', 'genouG', 'patteArG', 'hancheD', 'genouD', 'patteArD',
];
const I = Object.fromEntries(POINTS.map((p, i) => [p, i]));
const MOYENNE = [123.675, 116.28, 103.53];
const ECART = [58.395, 57.12, 57.375];
const DIVISION_SIMCC = 2; // 2 cases SimCC par pixel d'entrée
export const TAILLE = 256; // entrée du modèle : TAILLE×TAILLE
export const AGRANDISSEMENT = 1.25; // marge autour du rectangle de l'animal, comme MMPose
export const SEUIL_POINT = 0.3;

let travailleur = null;
const enAttente = new Map(); // id → { ok, ko } des estimations en cours
let prochainId = 0;

export function chargerPosture(url) {
  return new Promise((ok, ko) => {
    travailleur = new Worker(new URL('./posture-worker.js', import.meta.url), { type: 'module' });
    travailleur.onerror = (e) => ko(new Error(e.message || 'worker de posture'));
    travailleur.onmessage = ({ data }) => {
      if (data.type === 'pret') return ok({ taille: TAILLE });
      const attente = enAttente.get(data.id);
      if (!attente) return ko(new Error(data.message)); // échec du chargement
      enAttente.delete(data.id);
      if (data.type === 'erreur') attente.ko(new Error(data.message));
      else attente.ok(decoderSimcc(data.x, data.y, POINTS.length, data.n));
    };
    travailleur.postMessage({ type: 'charger', url: new URL(url, location.href).href });
  });
}

// Découpe carrée centrée sur le rectangle de l'animal, agrandie de la marge MMPose.
export function decoupeCarree(boite) {
  const cote = Math.max(boite.w, boite.h) * AGRANDISSEMENT;
  return { x: boite.x + boite.w / 2 - cote / 2, y: boite.y + boite.h / 2 - cote / 2, w: cote, h: cote };
}

// canvas : la découpe déjà dessinée en TAILLE×TAILLE.
export function estimer(canvas) {
  const { data } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, TAILLE, TAILLE);
  const donnees = versNchw(data, TAILLE);
  const id = prochainId++;
  return new Promise((ok, ko) => {
    enAttente.set(id, { ok, ko });
    travailleur.postMessage({ type: 'estimer', id, donnees }, [donnees.buffer]);
  });
}

// Pixels RGBA (ImageData.data) → tenseur NCHW 1×3×taille×taille normalisé comme MMPose.
export function versNchw(rgba, taille) {
  const plan = taille * taille;
  const sortie = new Float32Array(3 * plan);
  for (let i = 0; i < plan; i++) {
    for (let c = 0; c < 3; c++) sortie[c * plan + i] = (rgba[i * 4 + c] - MOYENNE[c]) / ECART[c];
  }
  return sortie;
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
  // Deux yeux nettement écartés, tête et queue presque alignées : l'animal regarde l'objectif.
  // (De profil, RTMPose place souvent aussi l'œil caché : les yeux seuls ne suffisent pas.)
  const yeuxEcartes = yeux[0] && yeux[1] && Math.abs(yeux[0].x - yeux[1].x) > 0.08 * largeur;
  if (yeuxEcartes && Math.abs(dx) < 0.25 * largeur) profil = Math.min(profil, 0.35);
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
