// Géométrie pure : cadrage vidéo, zones de détection, conversions de repères.

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

// Zone de l'écran à faire analyser par le modèle, au ratio de son entrée (largeur / hauteur) :
// autour de l'animal suivi, sinon alternance vue entière / zone centrale (animaux lointains visés).
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

export function dansRect(point, r) {
  return point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h;
}

// Où dessiner la vidéo ENTIÈRE (drawImage(video, x, y, w, h)) pour que la zone `zone` de l'écran
// remplisse le rectangle `cible` d'un canvas, pour un cadrage `c` calculé sur la taille annoncée
// vw×vh. Sans découpe de la source, le navigateur étire l'image réellement reçue : juste après
// l'allumage, iOS livre des images plus petites que videoWidth/videoHeight, et une découpe calculée
// sur ces dimensions n'affichait qu'un quart de l'image (« bug du quart d'image »).
export function placementVideo(c, vw, vh, ecranW, ecranH, zone, cible) {
  const kx = ecranW / c.sw; // pixels vidéo → écran
  const ky = ecranH / c.sh;
  const sx = cible.w / zone.w; // écran → canvas cible
  const sy = cible.h / zone.h;
  return {
    x: cible.x + (-c.sx * kx - zone.x) * sx,
    y: cible.y + (-c.sy * ky - zone.y) * sy,
    w: vw * kx * sx,
    h: vh * ky * sy,
  };
}

// Rectangle source `src` (pixels vidéo) à dessiner sur une destination dw×dh, rogné aux bords de
// la vidéo (vw×vh) : renvoie les arguments de drawImage pour la partie visible, ou null.
// Safari dessine mal une source qui déborde de l'image.
export function rogner(src, vw, vh, dw, dh) {
  const kx = dw / src.sw;
  const ky = dh / src.sh;
  const x0 = Math.max(src.sx, 0);
  const y0 = Math.max(src.sy, 0);
  const x1 = Math.min(src.sx + src.sw, vw);
  const y1 = Math.min(src.sy + src.sh, vh);
  if (x1 <= x0 || y1 <= y0) return null;
  return {
    sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0,
    dx: (x0 - src.sx) * kx, dy: (y0 - src.sy) * ky, dw: (x1 - x0) * kx, dh: (y1 - y0) * ky,
  };
}

// Lissage exponentiel indépendant de la cadence : après `dt` secondes, la valeur a parcouru
// 1 − e^(−dt/tau) de l'écart vers la cible (63 % au bout de tau).
export function lisserVers(actuelle, cible, dt, tau) {
  return actuelle + (cible - actuelle) * (1 - Math.exp(-dt / tau));
}
