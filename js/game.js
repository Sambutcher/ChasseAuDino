// État du jeu, sans dépendance au navigateur : chaque fonction renvoie un nouvel état.
// Une partie alterne course (caméra éteinte, 100 m pour débloquer le tir) et tir (1 tomate à lancer :
// « cartouches » compte les tomates).
// Pendant le tir, l'espèce de la créature est verrouillée tant que l'animal reste en vue.

export const CARTOUCHES = 1;

// Une partie commence par la course jusqu'au pas de tir.
export function nouvelEtat() {
  return { phase: 'course', cartouches: 0, espece: null, issue: null, cibleVisible: false };
}

// En position de tir : carabine chargée, aucune créature en vue.
export function debloquerTir(etat) {
  return { ...etat, phase: 'tir', cartouches: CARTOUCHES, espece: null, issue: null, cibleVisible: false };
}

// Série terminée : retour à la course.
export function finSerie(etat) {
  return { ...etat, phase: 'course', cartouches: 0, espece: null, issue: null, cibleVisible: false };
}

export function serieTerminee(etat) {
  return etat.phase === 'tir' && etat.cartouches === 0;
}

// Cible d'espèce `cle` (clé de ESPECES) en vue : la créature correspondante apparaît et garde
// son espèce jusqu'à ce que la cible soit perdue.
export function voirCreature(etat, cle) {
  if (etat.cibleVisible) return etat;
  return { ...etat, cibleVisible: true, espece: etat.issue ? etat.espece : cle };
}

// Animal perdu avant le tir : l'espèce se déverrouille. Après le tir, elle reste pour l'animation.
export function quitterCreature(etat) {
  if (!etat.cibleVisible) return etat;
  return { ...etat, cibleVisible: false, espece: etat.issue ? etat.espece : null };
}

// Tir unique. `touche` : le viseur est sur la silhouette de la créature (calculé par le rendu 3D).
// resultat : 'touche', 'rate', ou null si le tir est impossible (pas de créature, plus de balle).
// Touchée, la créature explose ; ratée, elle s'enfuit.
export function tirer(etat, touche) {
  if (etat.phase !== 'tir' || !etat.cibleVisible || etat.cartouches === 0) return { etat, resultat: null };
  return {
    etat: { ...etat, cartouches: etat.cartouches - 1, issue: touche ? 'explosee' : 'enfuie' },
    resultat: touche ? 'touche' : 'rate',
  };
}
