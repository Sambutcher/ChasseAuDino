// Bestiaire : chaque cible détectée (classe COCO) est remplacée par une créature 3D. Les animaux
// ont chacun leur créature ; les voitures, un héros ou un squelette KayKit selon leur couleur.
// Logique pure, sans navigateur : table des espèces, choix des animations, messages.

const VOITURE = 2; // classe COCO « car »

// Clé → espèce.
// classe : classe COCO de la cible. cible : ce que la caméra voit (« vache », « voiture »).
// ton : 'kawaii' (sautille, explose en confettis) ou 'mechant' (grogne, explose en flammes).
// vol : la créature flotte au milieu de la boîte au lieu de poser les pieds en bas.
// clips : noms des animations du .glb (sans le préfixe « Armature| »).
// teintes : nouvelles couleurs par nom de matériau. yeux : yeux rougeoyants des méchants,
// par matériau ({ materiau }, Eye_White par défaut) ou par objet ({ objet }).
const HEROS = { attente: 'Idle', humeurs: ['Cheer', 'Jump_Full_Short', '1H_Melee_Attack_Chop'], fuite: 'Running_A' };
const SQUELETTE = { attente: 'Idle', humeurs: ['Taunt', 'Spellcast_Shoot', '1H_Melee_Attack_Chop'], fuite: 'Running_A' };
const heros = (nom, fichier) => ({
  classe: VOITURE, cible: 'voiture', nom, fichier: `models/creatures/${fichier}.glb`, ton: 'kawaii', vol: false,
  clips: HEROS,
});
const squelette = (nom, fichier) => ({
  ...heros(nom, fichier), ton: 'mechant', clips: SQUELETTE, yeux: { objet: '_Eyes' },
});

export const ESPECES = {
  chat: {
    classe: 15, cible: 'chat', nom: 'lapin', fichier: 'models/creatures/lapin.glb', ton: 'kawaii', vol: false,
    clips: { attente: 'Idle', humeurs: ['Wave', 'Jump', 'Yes'], fuite: 'Run' },
  },
  chien: {
    classe: 16, cible: 'chien', nom: 'loup', fichier: 'models/creatures/loup.glb', ton: 'mechant', vol: false,
    clips: { attente: 'Idle', humeurs: ['Attack', 'Idle_2_HeadLow'], fuite: 'Gallop' },
    teintes: { Main: '#2e3136', Main_Light: '#5d6168', Nose: '#111111' },
    yeux: { materiau: 'Eyes_Black' },
  },
  cheval: {
    classe: 17, cible: 'cheval', nom: 'licorne', fichier: 'models/creatures/licorne.glb', ton: 'kawaii', vol: false,
    clips: { attente: 'Idle', humeurs: ['Idle_2', 'Idle_Headlow'], fuite: 'Gallop' },
    feminin: true,
    teintes: { Main: '#fff4fa', Main_Light: '#ffffff', Muzzle: '#ffc4dc', Hooves: '#f6c945' },
    corne: true, // cheval transformé en licorne au chargement
  },
  mouton: {
    classe: 18, cible: 'mouton', nom: 'dragon', fichier: 'models/creatures/dragon.glb', ton: 'mechant', vol: true,
    clips: { attente: 'Flying_Idle', humeurs: ['Punch', 'Headbutt', 'No'], fuite: 'Fast_Flying' },
  },
  vache: {
    classe: 19, cible: 'vache', nom: 'dinosaure', fichier: 'models/creatures/dino.glb', ton: 'kawaii', vol: false,
    clips: { attente: 'Idle', humeurs: ['Wave', 'Jump', 'Yes'], fuite: 'Run' },
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
