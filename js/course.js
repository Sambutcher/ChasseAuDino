// Course entre deux tirs : il faut être à plus de `distance` mètres (à vol d'oiseau) du point
// de départ pour débloquer le tir ; revenir en deçà le rebloque. Pur, sans dépendance au navigateur.
// Une position (fix) : { lat, lon, precision (m), t (ms) }.

const RAYON_TERRE = 6371000;
const rad = (d) => (d * Math.PI) / 180;

// Distance en mètres entre deux positions (haversine).
export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAYON_TERRE * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function creerCourse({ distance = 100, precisionMax = 30, memoireMs = 10000, vitesseMax = 12 } = {}) {
  let recentes = []; // positions assez précises des dernières secondes
  let derniere = null; // dernière position reçue, même imprécise (affichage de la précision)
  let retenue = null; // dernière position acceptée (filtre de vitesse)
  let lancee = false;
  let depart = null;
  let parcourue = 0;

  return {
    ajouter(fix) {
      derniere = fix;
      if (fix.precision > precisionMax) return;
      // Saut aberrant du GPS : déplacement impossible à pied (> vitesseMax m/s) depuis la
      // dernière position acceptée. Le tir se débloque ainsi dès la première position valide.
      const dt = retenue ? (fix.t - retenue.t) / 1000 : 0;
      if (dt > 0 && distanceM(retenue, fix) / dt > vitesseMax) return;
      retenue = fix;
      recentes = [...recentes.filter((f) => fix.t - f.t <= memoireMs), fix];
      if (!lancee) return;
      if (!depart) {
        depart = fix;
        return;
      }
      parcourue = distanceM(depart, fix);
    },

    // Nouveau départ : la meilleure position récente, sinon la prochaine position précise.
    demarrer(t) {
      const candidates = recentes.filter((f) => t - f.t <= memoireMs);
      depart = candidates.length
        ? candidates.reduce((meilleure, f) => (f.precision <= meilleure.precision ? f : meilleure)) // à égalité, la plus récente
        : null;
      lancee = true;
      parcourue = 0;
    },

    // Mode debug : recule le départ de `metres` vers le sud, comme si l'on avait déjà couru
    // (un saut de la position elle-même serait rejeté par le filtre de vitesse).
    reculerDepart(metres) {
      if (!depart) return;
      depart = { ...depart, lat: depart.lat - metres / 111195 };
      if (retenue) parcourue = distanceM(depart, retenue);
    },

    etat() {
      const phase = !lancee ? 'arret' : !depart ? 'gps' : parcourue >= distance ? 'fini' : 'course';
      return { phase, distance: parcourue, objectif: distance, precision: derniere ? derniere.precision : null };
    },
  };
}
