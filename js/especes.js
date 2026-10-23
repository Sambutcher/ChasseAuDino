// Bestiaire : chaque cible détectée (classe COCO) est remplacée par une créature 3D. Les animaux
// ont chacun leur créature ; les voitures, un aliment tiré au hasard.
// Logique pure, sans navigateur : table des espèces, messages.

const VOITURE = 2; // classe COCO « car »

// Clé → espèce.
// classe : classe COCO de la cible. cible : ce que la caméra voit (« vache », « voiture »).
// ton : 'kawaii' (sautille, explose en confettis) ou 'mechant' (grogne, explose en flammes).
// epaisseur : facteur d'épaississement (hauteur et profondeur) d'un modèle trop plat.
// clips : clips d'animation des animaux riggés (js/clips.js) ; les aliments, statiques, n'en ont pas
// et js/animation.js les anime en code.
const CLIPS = {
  attente: 'Idle',
  mimiques: ['Idle_2', 'Gallop_Jump', 'Idle_HitReact1'],
  fuite: 'Gallop',
  tete: ['Idle_Headlow', 'Eating'], // tête baissée, quand l'animal broute
};
const creature = (classe, cible, nom, fichier, extra = {}) => ({
  classe, cible, nom, fichier: `models/creatures/${fichier}.glb`, ton: 'kawaii', ...extra,
});
const animal = (classe, cible, nom, fichier, extra = {}) => creature(classe, cible, nom, fichier, { clips: CLIPS, ...extra });
const aliment = (nom, fichier, extra = {}) => creature(VOITURE, 'voiture', nom, fichier, extra);

export const ESPECES = {
  chat: animal(15, 'chat', 'renard', 'renard'),
  chien: animal(16, 'chien', 'shiba', 'shiba'),
  cheval: animal(17, 'cheval', 'cheval', 'cheval'),
  mouton: animal(18, 'mouton', 'alpaga', 'alpaga'),
  vache: animal(19, 'vache', 'vache', 'vache', { feminin: true }),
  burger: aliment('burger', 'burger'),
  croissant: aliment('croissant', 'croissant'),
  eclair: aliment('éclair', 'eclair', { epaisseur: 1.8 }),
  frites: aliment('barquette de frites', 'frites', { feminin: true }),
  sushi: aliment('sushi', 'sushi'),
};

export const CLASSES = [...new Set(Object.values(ESPECES).map((e) => e.classe))].sort((a, b) => a - b);

// Espèce d'une cible : par sa classe ; une voiture devient un aliment tiré au hasard
// (hasard : fonction de tirage dans [0, 1[, injectable pour les tests).
export function especeDe(classe, hasard = Math.random) {
  if (classe === VOITURE) {
    const aliments = Object.keys(ESPECES).filter((cle) => ESPECES[cle].classe === VOITURE);
    return aliments[Math.floor(hasard() * aliments.length)];
  }
  return Object.keys(ESPECES).find((cle) => ESPECES[cle].classe === classe) ?? null;
}

export const estVoiture = (classe) => classe === VOITURE;

// Boîtes de la classe verrouillée pour la série (toutes si aucune).
export function filtrerEspece(boites, classe) {
  return classe === null ? boites : boites.filter((b) => b.classe === classe);
}

// Message affiché après le tir : « La vache a explosé ! », « L'alpaga s'est enfui ! ».
export function messageIssue(espece, issue) {
  const sujet = /^[aeiouyéèê]/i.test(espece.nom) ? `L'${espece.nom}` : `${espece.feminin ? 'La' : 'Le'} ${espece.nom}`;
  return issue === 'explosee' ? `${sujet} a explosé !` : `${sujet} s'est enfui${espece.feminin ? 'e' : ''} !`;
}
