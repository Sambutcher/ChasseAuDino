# Chasse aux bébêtes

Course et tir dans la rue, sur téléphone : la caméra cherche les **animaux** et les **voitures** et
les change en **créatures 3D**. Une seule tomate à lancer : touchée, la créature **explose** ; ratée, elle **s'enfuit**.

| Animal | Créature | Ton |
|---|---|---|
| vache | vache pastel | kawaii |
| cheval | cheval pastel | kawaii |
| chat | renard pastel | kawaii |
| chien | shiba pastel | kawaii |
| mouton | alpaga pastel | kawaii |

Les **voitures** deviennent un aliment tiré au hasard (burger, croissant, sushi, barquette de
frites ou éclair).

Les animaux sont des modèles à squelette : ils respirent, bougent oreilles et queue, bondissent,
broutent quand l'animal filmé a la tête baissée (clips du modèle, `js/clips.js`), galopent pour
fuir et explosent en étoiles colorées. Les aliments, statiques, sont animés en code (`js/animation.js`).

PWA installable, jouable **hors ligne**, pensée d'abord pour iPhone (iPhone SE 3ᵉ gén.).
Inspirée de [Street Biathlon](https://github.com/Sambutcher/StreetBiathlon), dont elle reprend le socle.

## Jouer

1. Ouvrir https://sambutcher.github.io/ChasseAuxBebetes/ dans Safari.
2. Partager → **Sur l'écran d'accueil** (une première ouverture en ligne met tout en cache).
3. Lancer, **Démarrer**, autoriser la localisation, puis la caméra au premier « Lancer de tomate ».

Une partie alterne **course** et **tir** :
- **Course** (caméra éteinte pour la batterie) : s'éloigner de **100 m à vol d'oiseau** du point de
  départ, mesuré au GPS. Garder l'écran allumé (iOS coupe le GPS écran verrouillé).
- Au-delà de 100 m, le bouton **Lancer de tomate** s'active : il rallume la caméra et met
  **une tomate** dans la main (en bas à droite). Le bouton **Skip** fait de même sans courir.
- **Tir** : trouvez un animal ou une voiture, la croix au centre sur la créature, un tap = la main lance la
  tomate en cloche vers la croix. Touchée à l'impact, la créature explose ; ratée (la croix hors de sa
  silhouette), elle s'enfuit. Puis nouvelle course.

Les sons sont synthétisés (aucun fichier) ; le bouton silencieux de l'iPhone les coupe.

## Développement

Aucun build : fichiers statiques et modules ES.

```bash
node --test tests/          # tests unitaires (Node ≥ 18, aucune dépendance)
python3 tools/serve.py      # HTTPS sur https://<ip-du-pc>:8443 (certificat auto-signé)
```

Sur l'iPhone, ouvrir l'adresse affichée et accepter le certificat. Le mode hors ligne (service
worker) ne se teste que sur GitHub Pages : en dev (adresse IP ou localhost), la page n'enregistre
pas de service worker et désinstalle ceux qui traînent, car leurs requêtes échouent avec le
certificat auto-signé. Si une page de dev affiche « FetchEvent.respondWith received an error »,
un ancien service worker (par exemple celui de Street Biathlon, servi à la même adresse) est
resté : Réglages → Apps → Safari → Avancé → Données des sites web → supprimer 192.168.1.147.
Pour tester la version en ligne sans être gêné par le cache hors ligne, utiliser la navigation
privée.

La mémoire graphique de l'iPhone SE est juste suffisante (détection TF.js + créatures three.js) :
textures TF.js libérées aussitôt, créatures sans anticrénelage ; si iOS retire malgré tout un
contexte WebGL, le jeu affiche « Mémoire saturée, redémarrage… » et se recharge.

| Fichier | Rôle |
|---|---|
| `js/main.js` | démarrage, boucle d'affichage, lancer et impact |
| `js/especes.js` | bestiaire : cible COCO → créature, voiture → aliment au hasard (pur, testé) |
| `js/creatures.js` | créatures three.js : placement, mimiques, explosion, fuite, test de touche |
| `js/posture.js` | orientation d'un animal d'après ses 20 points clés : profil, sens, dos (pur, testé) |
| `js/pose.js` | yolo11n-pose via TensorFlow.js : estimation sur un carré autour de l'animal |
| `js/cap.js` | cap d'une voiture : découpe, lissage, secteurs d'azimut → angle de l'aliment (pur, testé) |
| `js/cap-modele.js` | modèle d'orientation (MobileNetV3-Small) via TensorFlow.js : 8 secteurs d'azimut |
| `js/lancer.js` | main et tomate three.js : lancer en cloche vers le viseur, impact |
| `js/sons.js` | bruitages Web Audio synthétisés |
| `js/camera.js` | caméra arrière, relance de la lecture au retour sur la page |
| `js/detector.js` | YOLO11n via TensorFlow.js : décodage des 6 classes (voiture, 5 animaux), NMS |
| `js/flow.js` | flux optique : la créature suit l'image entre deux détections (pur, testé) |
| `js/tracker.js` | suivi de l'animal, hystérésis, espèce de la première vue (pur, testé) |
| `js/game.js` | état du jeu : phases course/tir, tomate unique, issue (pur, testé) |
| `js/course.js` | distance à vol d'oiseau, départ, déblocage du tir (pur, testé) |
| `js/position.js` | GPS (`watchPosition`), écran maintenu allumé |
| `js/geometry.js` | cadrage, letterbox, zones de détection, placement de la vidéo, lissage (pur, testé) |
| `js/render.js` | dessin 2D : vidéo, viseur forain et arc du lancer, messages, écran de course |
| `sw.js` | cache hors ligne |

**À chaque mise en ligne, changer `VERSION` dans `sw.js` et `index.html`** (`node --test tests/`
le vérifie, ainsi que la présence de chaque fichier dans le cache hors ligne), puis pousser sur
`v1-stable-sans-posture` : GitHub Pages republie aussitôt, et les téléphones passent à la nouvelle
version à leur prochaine ouverture.

## Modèles

- Détection : `models/yolo11n/`, YOLO11n (COCO) converti en TensorFlow.js, entrée 224×384,
  repris de Street Biathlon. Classes utilisées : voiture 2, chat 15, chien 16, cheval 17,
  mouton 18, vache 19.
- Créatures : `models/creatures/*.glb`, low-poly statiques (sans squelette). Animaux : maillages
  allégés (maillage simplifié, texture 512 px) par `tools/alleger_modeles.py` ; aliments : convertis
  en .glb (textures 256 px) par `tools/convertir_nourriture.py`. Les sources sont dans
  `Téléchargements/` (ignoré par git).
  Les icônes se régénèrent avec `python3 tools/icons.py` (Pillow).

## Licences et crédits

- Chasse aux bébêtes : **AGPL-3.0** (voir `LICENSE`), imposée par le modèle de détection.
- YOLO11n © Ultralytics, AGPL-3.0.
- TensorFlow.js 4.22.0 (`vendor/tf.min.js`), Apache-2.0.
- three.js 0.170.0 (`vendor/three.module.min.js`, `GLTFLoader.js`, `BufferGeometryUtils.js`), MIT
  (`vendor/three-LICENSE.txt`).
- Orientation des voitures : modèle MobileNetV3-Small du dépôt [OrientationVoiture](https://github.com/Sambutcher/OrientationVoiture),
  distillé d'[Orient Anything](https://github.com/SpatialVision/Orient-Anything) (Wang et al. 2024, CC BY 4.0) sur des voitures de COCO 2017.
- Animaux 3D : pack « Ultimate Animated Animals » de [Quaternius](https://quaternius.com/packs/ultimateanimatedanimals.html),
  CC0 (domaine public). Couleurs pastel et allègement des clips par `tools/preparer_animaux.py`.
- Cris des animaux (`sons/`, extraits et convertis en WAV) : Wikimedia Commons.
  shiba : [Barking of a dog](https://commons.wikimedia.org/wiki/File:Barking_of_a_dog.ogg) (Amada44, CC BY-SA 3.0) ;
  renard : [Meow domestic cat](https://commons.wikimedia.org/wiki/File:Meow_domestic_cat.ogg) (Smser, GFDL) ;
  cheval : [hennissement](https://commons.wikimedia.org/wiki/File:Mares-Prefer-the-Voices-of-Highly-Fertile-Stallions-pone.0118468.s001.oga) (Lemasson et al., PLOS ONE, CC BY 4.0) ;
  alpaga : [Lamb bleating and its mother's response](https://commons.wikimedia.org/wiki/File:Lamb_bleating_and_its_mother%27s_response.flac) (Yosef Ben Melamed, CC BY-SA 4.0) ;
  vache : [Single Cow Moo](https://commons.wikimedia.org/wiki/File:Single_Cow_Moo.ogg) (MichaeltheFox8621, CC BY-SA 4.0).
- Moteurs des aliments (`sons/moteur-*.wav`, montées en régime de 2 s extraites d'enregistrements « engine and exhaust sound », CC BY 3.0, Wikimedia Commons) :
  [Plymouth Duster](https://commons.wikimedia.org/wiki/File:Plymouth_Duster_-_engine_and_exhaust_sound_(YouTube_FWzja7TuZiw).opus),
  [Ford Thunderbird (1955)](https://commons.wikimedia.org/wiki/File:Ford_Thunderbird_(1955)_-_engine_and_exhaust_sound_(YouTube_KRMCr2o90FY).opus),
  [Austin Healey](https://commons.wikimedia.org/wiki/File:Austin_Healey_-_engine_and_exhaust_sound_(YouTube_Sry9AwH-3F0).opus).
- Aliments 3D : sources et licences à compléter.

## Idées pour plus tard

- Reprendre la pose des membres de l'animal (pattes, museau) : essai de squelette abandonné (rendu
  jugé moins bon que l'orientation seule).
