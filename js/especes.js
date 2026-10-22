// Bestiaire : chaque cible détectée (classe COCO) est remplacée par une créature 3D. Les animaux
// ont chacun leur créature ; les voitures, un héros ou un squelette KayKit selon leur couleur.
// Logique pure, sans navigateur : table des espèces, choix des animations, orientation.

const VOITURE = 2; // classe COCO « car »
const RATIOS_VOITURE = { face: 1.3, profil: 2.4 };

// Clé → espèce.
// classe : classe COCO de la cible. cible : ce que la caméra voit (« vache », « voiture »).
// ton : 'kawaii' (sautille, explose en confettis) ou 'mechant' (grogne, explose en flammes).
// vol : la créature flotte au milieu de la boîte au lieu de poser les pieds en bas.
// clips : noms des animations du .glb (sans le préfixe « Armature| »).
// ratios : largeur / hauteur du rectangle de la cible vue de face et de profil.
// teintes : nouvelles couleurs par nom de matériau. yeux : yeux rougeoyants des méchants,
// par matériau ({ materiau }, Eye_White par défaut) ou par objet ({ objet }).
const HEROS = { attente: 'Idle', humeurs: ['Cheer', 'Jump_Full_Short', '1H_Melee_Attack_Chop'], fuite: 'Running_A' };
const SQUELETTE = { attente: 'Idle', humeurs: ['Taunt', 'Spellcast_Shoot', '1H_Melee_Attack_Chop'], fuite: 'Running_A' };
const heros = (nom, fichier) => ({
  classe: VOITURE, cible: 'voiture', nom, fichier: `models/creatures/${fichier}.glb`, ton: 'kawaii', vol: false,
  clips: HEROS, ratios: RATIOS_VOITURE,
});
const squelette = (nom, fichier) => ({
  ...heros(nom, fichier), ton: 'mechant', clips: SQUELETTE, yeux: { objet: '_Eyes' },
});

export const ESPECES = {
  chat: {
    classe: 15, cible: 'chat', nom: 'lapin', fichier: 'models/creatures/lapin.glb', ton: 'kawaii', vol: false,
    clips: { attente: 'Idle', humeurs: ['Wave', 'Jump', 'Yes'], fuite: 'Run' },
    ratios: { face: 0.7, profil: 1.4 },
  },
  chien: {
    classe: 16, cible: 'chien', nom: 'loup', fichier: 'models/creatures/loup.glb', ton: 'mechant', vol: false,
    clips: { attente: 'Idle', humeurs: ['Attack', 'Idle_2_HeadLow'], fuite: 'Gallop' },
    ratios: { face: 0.7, profil: 1.3 },
    teintes: { Main: '#2e3136', Main_Light: '#5d6168', Nose: '#111111' },
    yeux: { materiau: 'Eyes_Black' },
  },
  cheval: {
    classe: 17, cible: 'cheval', nom: 'licorne', fichier: 'models/creatures/licorne.glb', ton: 'kawaii', vol: false,
    clips: { attente: 'Idle', humeurs: ['Idle_2', 'Idle_Headlow'], fuite: 'Gallop' },
    ratios: { face: 0.5, profil: 1.3 },
    feminin: true,
    teintes: { Main: '#fff4fa', Main_Light: '#ffffff', Muzzle: '#ffc4dc', Hooves: '#f6c945' },
    corne: true, // cheval transformé en licorne au chargement
  },
  mouton: {
    classe: 18, cible: 'mouton', nom: 'dragon', fichier: 'models/creatures/dragon.glb', ton: 'mechant', vol: true,
    clips: { attente: 'Flying_Idle', humeurs: ['Punch', 'Headbutt', 'No'], fuite: 'Fast_Flying' },
    ratios: { face: 0.8, profil: 1.4 },
  },
  vache: {
    classe: 19, cible: 'vache', nom: 'dinosaure', fichier: 'models/creatures/dino.glb', ton: 'kawaii', vol: false,
    clips: { attente: 'Idle', humeurs: ['Wave', 'Jump', 'Yes'], fuite: 'Run' },
    ratios: { face: 0.7, profil: 1.6 },
  },
  chevalier: heros('chevalier', 'chevalier'),
  barbare: heros('barbare', 'barbare'),
  mage: heros('mage', 'mage'),
  voleur: heros('voleur', 'voleur'),
  'voleur-capuche': heros('voleur encapuchonné', 'voleur-capuche'),
  'squelette-mage': squelette('squelette mage', 'squelette-mage'),
  'squelette-guerrier': squelette('squelette guerrier', 'squelette-guerrier'),
  'squelette-voleur': squelette('squelette voleur', 'squelette-voleur'),
};

// Couleur de la voiture → personnage, un « type » par couleur comme dans les jeux de monstres.
export const PERSONNAGES_VOITURE = {
  rouge: 'squelette-mage', // robe rouge
  orange: 'voleur', // cuir (et voitures marron)
  jaune: 'barbare',
  vert: 'voleur-capuche', // capuche verte
  bleu: 'mage', // robe bleue
  violet: 'mage',
  gris: 'chevalier', // armure argentée
  blanc: 'squelette-guerrier', // os blancs
  noir: 'squelette-voleur',
};

export const CLASSES = [...new Set(Object.values(ESPECES).map((e) => e.classe))].sort((a, b) => a - b);

// Espèce d'une cible : par sa classe, et pour une voiture par sa couleur (gris faute de mieux).
export function especeDe(classe, couleur = null) {
  if (classe === VOITURE) return PERSONNAGES_VOITURE[couleur] ?? PERSONNAGES_VOITURE.gris;
  return Object.keys(ESPECES).find((cle) => ESPECES[cle].classe === classe) ?? null;
}

export const estVoiture = (classe) => classe === VOITURE;

// Nom complet du clip dans la liste du .glb : « Idle » trouve « CharacterArmature|Idle ».
export function trouverClip(noms, nom) {
  return noms.find((n) => n === nom) ?? noms.find((n) => n.endsWith(`|${nom}`)) ?? null;
}

// Boîtes de la classe verrouillée pour la série (toutes si aucune).
export function filtrerEspece(boites, classe) {
  return classe === null ? boites : boites.filter((b) => b.classe === classe);
}

// Message affiché après le tir : « Le dragon a explosé ! », « La licorne s'est enfuie ! ».
export function messageIssue(espece, issue) {
  const sujet = `${espece.feminin ? 'La' : 'Le'} ${espece.nom}`;
  return issue === 'explosee' ? `${sujet} a explosé !` : `${sujet} s'est enfui${espece.feminin ? 'e' : ''} !`;
}

// Part de profil (0 face → 1 profil) d'après la forme du rectangle de la cible.
export function profilRectangle(espece, boite) {
  const { face, profil } = espece.ratios;
  return Math.max(0, Math.min(1, (boite.w / boite.h - face) / (profil - face)));
}

// Lacet de la créature (radians, 0 = face à la caméra, +π/2 = regarde vers la droite de l'écran).
// Sans sens connu, elle regarde vers le centre de l'écran (versCentre : −1 à 1).
export function lacet(profil, sens, versCentre) {
  const s = sens || Math.sign(versCentre) || 1;
  return s * profil * Math.PI / 2;
}
