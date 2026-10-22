// Géométrie pure : cadrage vidéo, cible à 3 ronds, test de touche.

// Portion de la source (sx, sy, sw, sh) à afficher pour couvrir la destination
// (comme object-fit: cover), puis agrandie d'un facteur `zoom` autour du centre.
export function cadrage(srcW, srcH, dstW, dstH, zoom = 1) {
  const echelle = Math.max(dstW / srcW, dstH / srcH) * zoom;
  const sw = dstW / echelle;
  const sh = dstH / echelle;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

// Placement d'une image (w, h) dans une entrée carrée ou rectangulaire (W, H)
// sans déformation, avec bandes de remplissage (letterbox).
export function letterbox(w, h, W, H) {
  const echelle = Math.min(W / w, H / h);
  const dw = w * echelle;
  const dh = h * echelle;
  return { dx: (W - dw) / 2, dy: (H - dh) / 2, dw, dh };
}

// Convertit une boîte exprimée dans l'entrée du modèle en coordonnées écran.
export function versEcran(boite, lb, ecranW, ecranH) {
  const kx = ecranW / lb.dw;
  const ky = ecranH / lb.dh;
  return {
    x: (boite.x - lb.dx) * kx,
    y: (boite.y - lb.dy) * ky,
    w: boite.w * kx,
    h: boite.h * ky,
  };
}

// Boîte dont le centre est le plus proche du point donné, ou null.
export function plusProcheDe(boites, point) {
  let meilleure = null;
  let dMin = Infinity;
  for (const b of boites) {
    const d = (b.x + b.w / 2 - point.x) ** 2 + (b.y + b.h / 2 - point.y) ** 2;
    if (d < dMin) {
      dMin = d;
      meilleure = b;
    }
  }
  return meilleure;
}

// Les 3 ronds de la cible, alignés sur les 3 lampes du feu (haut, milieu, bas).
export function ronds(cible) {
  const r = Math.min(cible.w / 2, cible.h / 6) * 0.65;
  const x = cible.x + cible.w / 2;
  return [1 / 6, 1 / 2, 5 / 6].map((f) => ({ x, y: cible.y + cible.h * f, r }));
}

// Indice du rond touché par un tir au point donné, ou -1.
export function rondVise(listeRonds, point) {
  let indice = -1;
  let dMin = Infinity;
  listeRonds.forEach((rond, i) => {
    const d = Math.hypot(rond.x - point.x, rond.y - point.y);
    if (d <= rond.r && d < dMin) {
      dMin = d;
      indice = i;
    }
  });
  return indice;
}

// Zone de l'écran à faire analyser par le modèle, au ratio de son entrée (largeur / hauteur) :
// autour du feu suivi, sinon alternance vue entière / zone centrale (feux lointains visés).
export function zoneDetection(cible, ecranW, ecranH, ratio, cycle) {
  const borner = (cx, cy, h) => {
    let w = h * ratio;
    if (w > ecranW) { w = ecranW; h = w / ratio; }
    if (h > ecranH) { h = ecranH; w = h * ratio; }
    const x = Math.min(Math.max(cx - w / 2, 0), ecranW - w);
    const y = Math.min(Math.max(cy - h / 2, 0), ecranH - h);
    return { x, y, w, h };
  };
  if (cible) {
    const h = Math.max(cible.h * 4, ecranH / 4);
    return { ...borner(cible.x + cible.w / 2, cible.y + cible.h / 2, h), type: 'cible' };
  }
  if (cycle % 2) return { ...borner(ecranW / 2, ecranH / 2, ecranH / 2), type: 'centre' };
  return { x: 0, y: 0, w: ecranW, h: ecranH, type: 'vue' };
}

// Rectangle de la vidéo correspondant à une zone de l'écran, pour un cadrage donné.
export function zoneVersSource(zone, c, ecranW, ecranH) {
  const kx = c.sw / ecranW;
  const ky = c.sh / ecranH;
  return { sx: c.sx + zone.x * kx, sy: c.sy + zone.y * ky, sw: zone.w * kx, sh: zone.h * ky };
}

// Plaque blanche de la cible : la boîte du feu agrandie d'une marge.
export function plaque(boite) {
  const marge = boite.w * 0.15;
  return { x: boite.x - marge, y: boite.y - marge, w: boite.w + 2 * marge, h: boite.h + 2 * marge };
}

export function dansRect(point, r) {
  return point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h;
}
