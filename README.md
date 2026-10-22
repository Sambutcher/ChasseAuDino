# Chasse au dino

Course et tir dans la rue, sur téléphone : la caméra cherche les **animaux** et les **voitures** et
les change en **créatures 3D**, tournées comme la cible (profil ou face, regard à gauche ou à
droite). Une seule cartouche : touchée, la créature **explose** ; ratée, elle **s'enfuit**.

| Animal | Créature | Ton |
|---|---|---|
| vache | dinosaure | kawaii |
| cheval | licorne | kawaii |
| chat | lapin | kawaii |
| chien | loup | méchant |
| mouton | dragon | méchant |

Les **voitures** deviennent un héros ou un squelette selon leur couleur, comme un « type » :

| Couleur | Personnage | Ton |
|---|---|---|
| grise / argent | chevalier | kawaii |
| bleue, violette | mage | kawaii |
| verte | voleur encapuchonné | kawaii |
| orange, marron | voleur | kawaii |
| jaune | barbare | kawaii |
| rouge | squelette mage | méchant |
| blanche | squelette guerrier | méchant |
| noire | squelette voleur | méchant |

Les créatures kawaii sautillent, font coucou et explosent en étoiles colorées ; les méchantes
grognent, ont les yeux rouges et explosent en flammes et fumée.

**Orientation** : la posture des animaux (yeux, nez, base de la queue…) est lue par un second
modèle, RTMPose, environ trois fois par seconde ; à défaut (voitures, modèle absent, posture
illisible), la forme du rectangle dit profil ou face et la créature regarde vers le centre.

PWA installable, jouable **hors ligne**, pensée d'abord pour iPhone (iPhone SE 3ᵉ gén.).
Inspirée de [Street Biathlon](https://github.com/Sambutcher/StreetBiathlon), dont elle reprend le socle.

## Jouer

1. Ouvrir https://sambutcher.github.io/ChasseAuDino/ dans Safari.
2. Partager → **Sur l'écran d'accueil** (une première ouverture en ligne met tout en cache).
3. Lancer, **Démarrer**, autoriser la localisation, puis la caméra au premier « Position de tir ».

Une partie alterne **course** et **tir** :
- **Course** (caméra éteinte pour la batterie) : s'éloigner de **100 m à vol d'oiseau** du point de
  départ, mesuré au GPS. Garder l'écran allumé (iOS coupe le GPS écran verrouillé).
- Au-delà de 100 m, le bouton **Position de tir** s'active : il rallume la caméra et charge
  **une cartouche**.
- **Tir** : trouvez un animal ou une voiture, la croix au centre sur la créature, un tap = le tir. Touchée, elle
  explose ; ratée (la croix hors de sa silhouette), elle s'enfuit. Puis nouvelle course.

Les sons sont synthétisés (aucun fichier) ; le bouton silencieux de l'iPhone les coupe.

## Développement

Aucun build : fichiers statiques et modules ES.

```bash
node --test tests/          # tests unitaires (Node ≥ 18, aucune dépendance)
python3 tools/serve.py      # HTTPS sur https://<ip-du-pc>:8443 (certificat auto-signé)
```

- `?simgps` simule la course (~3 m/s, environ 35 s pour 100 m) sans bouger.
- `?debug` affiche images/s, détections/s, durées d'inférence (détection, posture), flux optique,
  espèce suivie, regard, profil, couleur de la voiture et points de posture, et un bouton « Debug : +110 m » sur l'écran de course qui débloque aussitôt le tir.
- `tests/bestiaire.html` montre les 13 créatures sans caméra : mimiques, explosion, fuite,
  orientations (← profil, face, profil →) et tir au viseur pour vérifier la silhouette.
- `tests/mire.html` passe 27 vraies photos d'animaux et de voitures (Wikimedia Commons, licences
  libres, chargées en ligne) dans le détecteur : créature choisie, couleur des voitures, points de
  posture et regard des animaux, et tableau de détection selon la distance. Clic = plein écran,
  pour viser l'écran du PC avec l'iPhone en jeu.

Sur l'iPhone, ouvrir l'adresse affichée et accepter le certificat. Le mode hors ligne (service
worker) ne se teste que sur GitHub Pages : en dev (adresse IP ou localhost), la page n'enregistre
pas de service worker et désinstalle ceux qui traînent, car leurs requêtes échouent avec le
certificat auto-signé. Si une page de dev affiche « FetchEvent.respondWith received an error »,
un ancien service worker (par exemple celui de Street Biathlon, servi à la même adresse) est
resté : Réglages → Apps → Safari → Avancé → Données des sites web → supprimer 192.168.1.147.

| Fichier | Rôle |
|---|---|
| `js/main.js` | démarrage, boucle d'affichage, tir |
| `js/especes.js` | bestiaire : cible COCO → créature, couleur → personnage, orientation (pur, testé) |
| `js/couleur.js` | couleur d'une voiture d'après sa carrosserie (pur, testé) |
| `js/posture.js` | posture RTMPose : points clés, sens du regard, profil (décodage pur, testé) |
| `js/creatures.js` | créatures three.js : placement, orientation, mimiques, licorne, explosion, fuite, test de touche |
| `js/sons.js` | bruitages Web Audio synthétisés |
| `js/camera.js` | caméra arrière |
| `js/detector.js` | YOLO11n via TensorFlow.js : décodage des 6 classes (voiture, 5 animaux), NMS |
| `js/flow.js` | flux optique : la créature suit l'image entre deux détections (pur, testé) |
| `js/tracker.js` | suivi de l'animal, hystérésis, espèce de la première vue (pur, testé) |
| `js/game.js` | état du jeu : phases course/tir, cartouche unique, issue (pur, testé) |
| `js/course.js` | distance à vol d'oiseau, départ, déblocage du tir (pur, testé) |
| `js/position.js` | GPS (`watchPosition`), simulation `?simgps`, écran maintenu allumé |
| `js/geometry.js` | cadrage, letterbox, zones de détection (pur, testé) |
| `js/render.js` | dessin 2D : vidéo, viseur, cartouche, messages, écran de course |
| `sw.js` | cache hors ligne |

**À chaque mise en ligne, changer `VERSION` dans `sw.js` et `index.html`** (`node --test tests/`
le vérifie, ainsi que la présence de chaque fichier dans le cache hors ligne), merger dans `main`,
puis créer la release (`gh release create vX.Y.Z`).

## Modèles

- Détection : `models/yolo11n/`, YOLO11n (COCO) converti en TensorFlow.js, entrée 224×384,
  repris de Street Biathlon. Classes utilisées : voiture 2, chat 15, chien 16, cheval 17,
  mouton 18, vache 19.
- Posture : `models/rtmpose-ap10k/`, RTMPose-m (MMPose) entraîné sur AP-10K (17 points clés
  animaux), converti en TensorFlow.js float16 par le workflow manuel « Export du modèle de
  posture » (`gh workflow run export-posture.yml -R Sambutcher/ChasseAuDino --ref <branche>`),
  contrôlé contre ONNX Runtime ; copier l'artefact dans `models/`. Sans lui, le jeu marche
  (orientation par la forme du rectangle).
- Créatures : `models/creatures/*.glb`, low-poly animés. Les personnages KayKit sont allégés
  (7 animations, un équipement) par `python3 tools/alleger_kaykit.py <dossier des .glb KayKit>`.
  Les icônes se régénèrent avec `python3 tools/icons.py` (Pillow).

## Licences et crédits

- Chasse au dino : **AGPL-3.0** (voir `LICENSE`), imposée par le modèle de détection.
- YOLO11n © Ultralytics, AGPL-3.0.
- TensorFlow.js 4.22.0 (`vendor/tf.min.js`), Apache-2.0.
- three.js 0.170.0 (`vendor/three.module.min.js`, `GLTFLoader.js`, `BufferGeometryUtils.js`), MIT
  (`vendor/three-LICENSE.txt`).
- Créatures par [Quaternius](https://quaternius.com), domaine public (CC0), via
  [Poly Pizza](https://poly.pizza) : Dino, Bunny, Dragon Evolved
  ([Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html)) et White Horse
  (base de la licorne), Wolf (le loup). Merci !
- Héros et squelettes par [Kay Lousberg](https://www.kaylousberg.com) (KayKit Adventurers et
  Skeletons Character Packs), domaine public (CC0). Merci !
- RTMPose / [MMPose](https://github.com/open-mmlab/mmpose) © OpenMMLab, Apache-2.0 ; entraîné sur
  [AP-10K](https://github.com/AlexTheBad/AP-10K) (CC-BY-4.0) après pré-entraînement AIC + COCO.
- `tools/chien.jpg` : « Dalmatian fetching a stick », Wikimedia Commons, CC BY-SA 4.0.
