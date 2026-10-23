// Bestiaire : chaque cible détectée (classe COCO) est remplacée par une créature 3D. Les animaux
// ont chacun leur créature ; les voitures, un aliment selon leur couleur.
// Logique pure, sans navigateur : table des espèces, messages.

const VOITURE = 2; // classe COCO « car »

// Clé → espèce.
// classe : classe COCO de la cible. cible : ce que la caméra voit (« vache », « voiture »).
// ton : 'kawaii' (sautille, explose en confettis) ou 'mechant' (grogne, explose en flammes).
// vol : la créature flotte au milieu de la boîte au lieu de poser les pieds en bas.
// epaisseur : facteur d'épaississement (hauteur et profondeur) d'un modèle trop plat.
// Les modèles sont statiques : js/animation.js les anime en code.
const creature = (classe, cible, nom, fichier, extra = {}) => ({
  classe, cible, nom, fichier: `models/creatures/${fichier}.glb`, ton: 'kawaii', vol: false, ...extra,
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

// Couleur de la voiture → aliment.
export const ALIMENTS_VOITURE = {
  rouge: 'burger', // ketchup
  orange: 'croissant',
  jaune: 'croissant',
  vert: 'sushi', // algue et avocat
  bleu: 'sushi',
  violet: 'sushi',
  gris: 'frites', // aussi la couleur par défaut
  blanc: 'frites',
  noir: 'eclair', // glaçage au chocolat
};

export const CLASSES = [...new Set(Object.values(ESPECES).map((e) => e.classe))].sort((a, b) => a - b);

// Espèce d'une cible : par sa classe, et pour une voiture par sa couleur (gris faute de mieux).
export function especeDe(classe, couleur = null) {
  if (classe === VOITURE) return ALIMENTS_VOITURE[couleur] ?? ALIMENTS_VOITURE.gris;
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
