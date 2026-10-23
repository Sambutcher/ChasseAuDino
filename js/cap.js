// Cap des voitures : recadrage donné au modèle d'orientation (MobileNetV3-Small distillé d'Orient
// Anything, dépôt OrientationVoiture) et conversion de ses 8 secteurs d'azimut en angle de la
// créature. Logique pure, sans navigateur. Le recadrage doit rester identique à celui de
// l'apprentissage (MARGE, TAILLE_ENTREE, GRIS) : ne le changer qu'avec le modèle.
export const MARGE = 1.2;
export const TAILLE_ENTREE = 128;
export const GRIS = 'rgb(128,128,128)';
export const NB_SECTEURS = 8;
const POIDS_NOUVEAU = 0.4; // part de la nouvelle mesure dans la moyenne glissante des probabilités

// Carré centré sur la boîte, côté = plus grand côté × MARGE (peut déborder de l'écran).
export function decoupeCarree(boite) {
  const cote = Math.max(boite.w, boite.h) * MARGE;
  return { x: boite.x + boite.w / 2 - cote / 2, y: boite.y + boite.h / 2 - cote / 2, cote };
}

// Rectangles source (écran) → destination pour dessiner la découpe dans un carré de `taille` px,
// la partie hors de l'écran restant grise ; null si la découpe est entièrement dehors.
export function rectanglesDecoupe(decoupe, ecranW, ecranH, taille = TAILLE_ENTREE) {
  const k = taille / decoupe.cote;
  const sx = Math.max(0, decoupe.x);
  const sy = Math.max(0, decoupe.y);
  const sw = Math.min(ecranW, decoupe.x + decoupe.cote) - sx;
  const sh = Math.min(ecranH, decoupe.y + decoupe.cote) - sy;
  if (sw <= 0 || sh <= 0) return null;
  return { source: { x: sx, y: sy, w: sw, h: sh }, dest: { x: (sx - decoupe.x) * k, y: (sy - decoupe.y) * k, w: sw * k, h: sh * k } };
}

// Moyenne glissante des probabilités des secteurs d'une même voiture.
export function lisserProbas(precedentes, mesure, poids = POIDS_NOUVEAU) {
  if (!precedentes) return mesure;
  return mesure.map((p, i) => precedentes[i] + (p - precedentes[i]) * poids);
}

// Angle de la créature (avant du modèle = +Z, positif vers la droite de l'image, de face 0) pour
// des probabilités de secteurs. Secteur k = azimut k × 45° d'Orient Anything, 0 = voiture vue de
// face, 90° = avant à gauche de l'image (vérifié sur la planche de distillation) : lacet = −azimut.
// Moyenne circulaire pondérée, pour que deux secteurs voisins donnent l'angle entre eux.
export function lacetDeProbas(probas) {
  let s = 0;
  let c = 0;
  probas.forEach((p, k) => {
    const lacet = -(k * 2 * Math.PI) / NB_SECTEURS;
    s += p * Math.sin(lacet);
    c += p * Math.cos(lacet);
  });
  return Math.atan2(s, c);
}

// Les aliments sont modelés « de côté » : vus de face (lacet 0), ils montrent le flanc de la voiture.
// Leur avant n'est donc pas l'avant de la voiture : on tourne de 90° (voiture de profil, avant à
// droite → lacet 0). Résultat ramené dans ]−π, π].
export const DECALAGE_ALIMENT = -Math.PI / 2;
export function lacetAliment(probas) {
  return Math.atan2(Math.sin(lacetDeProbas(probas) + DECALAGE_ALIMENT), Math.cos(lacetDeProbas(probas) + DECALAGE_ALIMENT));
}

// Les derniers secteurs dominants sont-ils tous identiques ? Le cap change peu : on l'estime moins souvent.
export function capStable(secteurs, taille = 3) {
  return secteurs.length >= taille && secteurs.every((k) => k === secteurs[0]);
}
