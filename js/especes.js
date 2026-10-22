// Bestiaire : chaque animal détecté (classe COCO) est remplacé par une créature 3D.
// Logique pure, sans navigateur : table des espèces et choix des animations.

// ton : 'kawaii' (sautille, explose en confettis) ou 'mechant' (grogne, explose en flammes).
// vol : la créature flotte au milieu de la boîte au lieu de poser les pieds en bas.
// clips : noms des animations du .glb (sans le préfixe « Armature| »).
// cap : rotation de base (radians) pour un modèle qui regarderait la caméra de face trop étroit.
// teintes : nouvelles couleurs par nom de matériau. yeux : matériau des yeux, rougeoyants chez
// les méchants (Eye_White par défaut).
export const ESPECES = {
  15: {
    animal: 'chat', nom: 'lapin', fichier: 'models/creatures/lapin.glb', ton: 'kawaii', vol: false,
    clips: { attente: 'Idle', humeurs: ['Wave', 'Jump', 'Yes'], fuite: 'Run' },
  },
  16: {
    animal: 'chien', nom: 'loup', fichier: 'models/creatures/loup.glb', ton: 'mechant', vol: false,
    clips: { attente: 'Idle', humeurs: ['Attack', 'Idle_2_HeadLow'], fuite: 'Gallop' },
    cap: 0.9, // vu de trois quarts plutôt que de face
    teintes: { Main: '#2e3136', Main_Light: '#5d6168', Nose: '#111111' },
    yeux: 'Eyes_Black',
  },
  17: {
    animal: 'cheval', nom: 'licorne', fichier: 'models/creatures/licorne.glb', ton: 'kawaii', vol: false,
    clips: { attente: 'Idle', humeurs: ['Idle_2', 'Idle_Headlow'], fuite: 'Gallop' },
    feminin: true,
    cap: 0.9, // cheval vu de trois quarts plutôt que de face
    teintes: { Main: '#fff4fa', Main_Light: '#ffffff', Muzzle: '#ffc4dc', Hooves: '#f6c945' },
    corne: true, // cheval transformé en licorne au chargement
  },
  18: {
    animal: 'mouton', nom: 'dragon', fichier: 'models/creatures/dragon.glb', ton: 'mechant', vol: true,
    clips: { attente: 'Flying_Idle', humeurs: ['Punch', 'Headbutt', 'No'], fuite: 'Fast_Flying' },
  },
  19: {
    animal: 'vache', nom: 'dinosaure', fichier: 'models/creatures/dino.glb', ton: 'kawaii', vol: false,
    clips: { attente: 'Idle', humeurs: ['Wave', 'Jump', 'Yes'], fuite: 'Run' },
  },
};

export const CLASSES = Object.keys(ESPECES).map(Number);

// Nom complet du clip dans la liste du .glb : « Idle » trouve « CharacterArmature|Idle ».
export function trouverClip(noms, nom) {
  return noms.find((n) => n === nom) ?? noms.find((n) => n.endsWith(`|${nom}`)) ?? null;
}

// Boîtes de l'espèce verrouillée pour la série (toutes si aucune).
export function filtrerEspece(boites, classe) {
  return classe === null ? boites : boites.filter((b) => b.classe === classe);
}

// Message affiché après le tir : « Le dragon a explosé ! », « La licorne s'est enfuie ! ».
export function messageIssue(espece, issue) {
  const sujet = `${espece.feminin ? 'La' : 'Le'} ${espece.nom}`;
  return issue === 'explosee' ? `${sujet} a explosé !` : `${sujet} s'est enfui${espece.feminin ? 'e' : ''} !`;
}
