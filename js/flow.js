// Mesure du déplacement de l'image entre deux trames, par recherche de bloc (SAD).
// Le feu est fixe dans le monde : quand le téléphone bouge, la zone autour de lui se
// déplace d'un bloc, ce qui permet à la cible de suivre entre deux détections.

const TEXTURE_MIN = 3; // écart moyen à la moyenne en dessous duquel le bloc est trop uni

// Luminance (0–255) d'une image RGBA.
export function versGris(rgba) {
  const gris = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; j < gris.length; i += 4, j++) {
    gris[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  }
  return gris;
}

// Décalage (dx, dy) tel que le bloc `zone` de `prec` se retrouve en zone + (dx, dy) dans `cour`.
// fiable = false si le bloc est trop uni ou trop petit pour conclure.
export function estimerDecalage(prec, cour, largeur, hauteur, zone, rayon = 12) {
  const x0 = Math.max(rayon, Math.floor(zone.x));
  const y0 = Math.max(rayon, Math.floor(zone.y));
  const x1 = Math.min(largeur - rayon, Math.ceil(zone.x + zone.w));
  const y1 = Math.min(hauteur - rayon, Math.ceil(zone.y + zone.h));
  if (x1 - x0 < 6 || y1 - y0 < 6) return { dx: 0, dy: 0, fiable: false };

  // Échantillonnage limité à ~1000 points pour borner le coût, quelle que soit la taille du bloc.
  const pas = Math.max(1, Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / 1000)));
  if (texture(prec, largeur, x0, y0, x1, y1, pas) < TEXTURE_MIN) return { dx: 0, dy: 0, fiable: false };

  const sad = (dx, dy) => {
    let somme = 0;
    for (let y = y0; y < y1; y += pas) {
      const lp = y * largeur;
      const lc = (y + dy) * largeur + dx;
      for (let x = x0; x < x1; x += pas) {
        const d = prec[lp + x] - cour[lc + x];
        somme += d < 0 ? -d : d;
      }
    }
    return somme;
  };

  // Recherche exhaustive : (2·rayon+1)² positions, ~1 M opérations pour un bloc de 1500 px.
  let meilleur = { dx: 0, dy: 0, sad: sad(0, 0) };
  for (let dy = -rayon; dy <= rayon; dy++) {
    for (let dx = -rayon; dx <= rayon; dx++) {
      const s = sad(dx, dy);
      if (s < meilleur.sad) meilleur = { dx, dy, sad: s };
    }
  }
  return { dx: meilleur.dx, dy: meilleur.dy, fiable: true };
}

function texture(img, largeur, x0, y0, x1, y1, pas) {
  let somme = 0;
  let n = 0;
  for (let y = y0; y < y1; y += pas) for (let x = x0; x < x1; x += pas) { somme += img[y * largeur + x]; n++; }
  const moyenne = somme / n;
  let ecart = 0;
  for (let y = y0; y < y1; y += pas) for (let x = x0; x < x1; x += pas) ecart += Math.abs(img[y * largeur + x] - moyenne);
  return ecart / n;
}
