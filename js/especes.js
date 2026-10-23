// Bestiaire : chaque cible détectée (classe COCO) est remplacée par une créature 3D. Les animaux
// ont chacun leur créature ; les voitures, un aliment tiré au hasard.
// Logique pure, sans navigateur : table des espèces, messages.

const VOITURE = 2; // classe COCO « car »

// Clé → espèce.
// classe : classe COCO de la cible. cible : ce que la caméra voit (« vache », « voiture »).
// ton : 'kawaii' (sautille, explose en confettis) ou 'mechant' (grogne, explose en flammes).
// epaisseur : facteur d'épaississement (hauteur et profondeur) d'un modèle trop plat.
// Les modèles sont statiques : js/animation.js les anime en code.
const creature = (classe, cible, nom, fichier, extra = {}) => ({
  classe, cible, nom, fichier: `models/creatures/${fichier}.glb`, ton: 'kawaii', ...extra,
});
const aliment = (nom, fichier, extra = {}) => creature(VOITURE, 'voiture', nom, fichier, extra);

export const ESPECES = {
  chat: creature(15, 'chat', 'chaton', 'chaton'),
  chien: creature(16, 'chien', 'chiot', 'chiot'),
  cheval: creature(17, 'cheval', 'licorne', 'licorne', { feminin: true }),
  mouton: creature(18, 'mouton', 'panda', 'panda'),
  vache: creature(19, 'vache', 'dragon', 'dragon'),
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

// Message affiché après le tir : « Le dragon a explosé ! », « La licorne s'est enfuie ! ».
export function messageIssue(espece, issue) {
  const sujet = `${espece.feminin ? 'La' : 'Le'} ${espece.nom}`;
  return issue === 'explosee' ? `${sujet} a explosé !` : `${sujet} s'est enfui${espece.feminin ? 'e' : ''} !`;
}
