// Suivi de l'animal : déplacé à chaque image par le flux optique, recalé à chaque détection,
// avec hystérésis d'apparition/disparition et refus des sauts non confirmés.

export function creerSuivi({
  confirmations = 2,
  persistanceMs = 1000,
  confirmationsSaut = 2,
  fenetreTaille = 5, // nombre de détections pour la médiane de taille
  zoneMorteTaille = 0.1, // écart relatif en dessous duquel la taille affichée ne bouge pas
  lissagePosition = 0.5, // part de l'écart rattrapée quand la détection est proche
  ecartLisse = 0.25, // au-delà de cette fraction de la hauteur, recalage direct
} = {}) {
  let cible = null;
  let vues = 0;
  let derniereVue = -Infinity;
  let candidat = null; // détection lointaine en attente de confirmation
  let tailles = []; // dernières tailles détectées
  const cumul = { x: 0, y: 0 }; // déplacement total de l'image depuis le début

  function oublier() {
    cible = null;
    vues = 0;
    candidat = null;
    tailles = [];
    enAjustement = false;
  }

  const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const proches = (a, b) => {
    const ca = centre(a);
    const cb = centre(b);
    return Math.hypot(ca.x - cb.x, ca.y - cb.y) <= Math.max(a.w, a.h);
  };
  const mediane = (valeurs) => {
    const v = [...valeurs].sort((a, b) => a - b);
    const m = v.length >> 1;
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  // La taille affichée ne bouge que si la médiane s'en écarte nettement (zone morte), puis la
  // rejoint par moitié jusqu'à 2 % près avant de se figer de nouveau (hystérésis).
  let enAjustement = false;
  const ecartRelatif = (actuelle, visee) => Math.abs(visee - actuelle) / actuelle;
  function ajusterTaille(med) {
    const ecart = Math.max(ecartRelatif(cible.w, med.w), ecartRelatif(cible.h, med.h));
    if (ecart > zoneMorteTaille) enAjustement = true;
    else if (ecart < 0.02) enAjustement = false;
    if (!enAjustement) return { w: cible.w, h: cible.h };
    return { w: cible.w + (med.w - cible.w) / 2, h: cible.h + (med.h - cible.h) / 2 };
  }

  return {
    // Déplacement de l'image mesuré entre deux trames (coordonnées écran).
    deplacer(dx, dy) {
      cumul.x += dx;
      cumul.y += dy;
      if (cible) { cible.x += dx; cible.y += dy; }
      if (candidat) { candidat.boite.x += dx; candidat.boite.y += dy; }
    },

    // Déplacement total, à mémoriser au lancement d'une détection pour compenser sa latence.
    get cumul() { return { ...cumul }; },

    // Résultat d'une détection (boîte écran déjà compensée, ou null).
    maj(boite, t) {
      if (!boite) {
        if (t - derniereVue > persistanceMs) oublier();
        return;
      }
      if (cible && !proches(cible, boite)) {
        candidat = candidat && proches(candidat.boite, boite)
          ? { boite: { ...boite }, vues: candidat.vues + 1 }
          : { boite: { ...boite }, vues: 1 };
        if (candidat.vues < confirmationsSaut) return;
        cible = null; // saut confirmé : on repart de la nouvelle boîte
        tailles = [];
      }
      candidat = null;
      vues++;
      derniereVue = t;
      tailles = [...tailles.slice(1 - fenetreTaille), { w: boite.w, h: boite.h }];
      if (!cible) {
        cible = { ...boite };
        return;
      }

      const { w, h } = ajusterTaille({
        w: mediane(tailles.map((s) => s.w)),
        h: mediane(tailles.map((s) => s.h)),
      });
      // Position : le flux optique gère le mouvement ; petit écart = bruit de détection, amorti.
      const cc = centre(cible);
      const cd = centre(boite);
      const k = Math.hypot(cd.x - cc.x, cd.y - cc.y) < cible.h * ecartLisse ? lissagePosition : 1;
      const x = cc.x + (cd.x - cc.x) * k;
      const y = cc.y + (cd.y - cc.y) * k;
      cible = { x: x - w / 2, y: y - h / 2, w, h, classe: cible.classe }; // espèce de la 1re vue
    },

    // État courant à l'instant t.
    lire(t) {
      if (cible && t - derniereVue > persistanceMs) oublier();
      return { cible, actif: cible !== null && vues >= confirmations };
    },
  };
}
