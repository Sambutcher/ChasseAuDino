// Couleur d'une voiture d'après les pixels de sa carrosserie. Pur, sans navigateur.

const PART_COLOREE = 0.3; // part de pixels saturés au-delà de laquelle la voiture est colorée
// Bornes hautes de teinte (degrés) de chaque couleur.
const TEINTES = [[15, 'rouge'], [40, 'orange'], [70, 'jaune'], [165, 'vert'], [255, 'bleu'], [330, 'violet'], [361, 'rouge']];

// Couleur d'un pixel : nuance (rouge…violet) s'il est assez saturé et lumineux, sinon blanc/gris/noir.
export function couleurPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max ? (max - min) / max : 0;
  if (v < 0.2) return 'noir'; // teinte illisible dans le sombre
  if (s < 0.25) return v > 0.75 ? 'blanc' : v < 0.3 ? 'noir' : 'gris';
  let h;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  return TEINTES.find(([borne]) => h < borne)[1];
}

export const estNuance = (c) => c !== 'blanc' && c !== 'gris' && c !== 'noir';

// Couleur d'une voiture d'après un échantillon RGBA (ImageData.data) de sa carrosserie :
// nuance majoritaire si assez de pixels sont colorés (reflets et vitres sont gris), sinon
// blanc, gris ou noir majoritaire.
export function couleurVoiture(rgba) {
  const nuances = new Map();
  const neutres = new Map();
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const c = couleurPixel(rgba[i], rgba[i + 1], rgba[i + 2]);
    const compte = estNuance(c) ? nuances : neutres;
    compte.set(c, (compte.get(c) ?? 0) + 1);
    total++;
  }
  const colores = [...nuances.values()].reduce((a, b) => a + b, 0);
  return majoritaire(colores >= PART_COLOREE * total ? nuances : neutres) ?? 'gris';
}

// Valeur la plus fréquente d'une liste (vote sur plusieurs images).
export function majorite(votes) {
  const compte = new Map();
  for (const v of votes) compte.set(v, (compte.get(v) ?? 0) + 1);
  return majoritaire(compte);
}

function majoritaire(compte) {
  let meilleure = null;
  let n = 0;
  for (const [c, k] of compte) {
    if (k > n) {
      meilleure = c;
      n = k;
    }
  }
  return meilleure;
}

// Zone de carrosserie dans le rectangle d'une voiture : bande centrale, sous les vitres.
export function zoneCarrosserie(boite) {
  return { x: boite.x + boite.w * 0.2, y: boite.y + boite.h * 0.5, w: boite.w * 0.6, h: boite.h * 0.3 };
}
