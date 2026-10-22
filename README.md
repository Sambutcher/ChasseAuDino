# Street Biathlon

Biathlon urbain sur téléphone : la caméra cherche les **feux tricolores**, les remplace par une
**cible de biathlon à 3 ronds**, et on tire en tapant l'écran pour **blanchir** les ronds.

PWA installable, jouable **hors ligne**, pensée d'abord pour iPhone (testée sur iPhone SE 3ᵉ gén.).

## Jouer

1. Ouvrir https://sambutcher.github.io/StreetBiathlon/ dans Safari.
2. Partager → **Sur l'écran d'accueil** (une première ouverture en ligne met tout en cache).
3. Lancer, **Démarrer**, autoriser la localisation, puis la caméra au premier « Position de tir ».

Une partie alterne **course** et **tir** :
- **Course** (caméra éteinte pour la batterie) : s'éloigner de **100 m à vol d'oiseau** du point de
  départ, mesuré au GPS. Garder l'écran allumé (iOS coupe le GPS écran verrouillé).
- Au-delà de 100 m, le bouton **Position de tir** s'active (il se regrise si l'on revient en deçà) :
  il rallume la caméra et charge 3 cartouches. L'écran de course n'affiche que la distance et une barre.
  La première course mène au pas de tir (prise de la carabine).
- **Tir** : visez un feu, croix au centre, un tap = un tir. Après la 3ᵉ balle, nouvelle course.

## Développement

Aucun build : fichiers statiques et modules ES.

```bash
node --test tests/          # tests unitaires (Node ≥ 18, aucune dépendance)
python3 tools/serve.py      # HTTPS sur https://<ip-du-pc>:8443 (certificat auto-signé)
```

Ajouter `?simgps` pour simuler la course (~3 m/s, environ 35 s pour 100 m) sans bouger.
Ajouter `?debug` à l'adresse pour afficher images/s, détections/s, durée d'inférence et flux optique.
`tests/mire.html` montre la détection sur des photos de feux (clic = plein écran pour viser).

Sur l'iPhone, ouvrir l'adresse affichée et accepter le certificat. La caméra et la détection
fonctionnent ; le mode hors ligne (service worker) ne se teste que sur GitHub Pages, Safari
refusant les service workers avec un certificat auto-signé.

| Fichier | Rôle |
|---|---|
| `js/main.js` | démarrage, boucle d'affichage, tirs |
| `js/camera.js` | caméra arrière |
| `js/detector.js` | YOLO11n via TensorFlow.js : décodage, NMS, classe « traffic light » |
| `js/flow.js` | flux optique (recherche de bloc) : la cible suit l'image entre deux détections (pur, testé) |
| `js/tracker.js` | suivi de la cible, compensation de latence, hystérésis (pur, testé) |
| `js/game.js` | état du jeu : phases course/tir, série (pur, testé) |
| `js/course.js` | distance à vol d'oiseau, départ, déblocage du tir (pur, testé) |
| `js/position.js` | GPS (`watchPosition`), simulation `?simgps`, écran maintenu allumé |
| `js/geometry.js` | cadrage, letterbox, ronds, test de touche (pur, testé) |
| `js/render.js` | dessin canvas |
| `sw.js` | cache hors ligne |

**À chaque mise en ligne, changer `VERSION` dans `sw.js`**, sinon les téléphones gardent
l'ancienne version en cache.

## Modèle de détection

`models/yolo11n/` est YOLO11n (COCO) converti en TensorFlow.js, entrée 224×384 (portrait) :

```bash
gh workflow run export-model.yml -R Sambutcher/StreetBiathlon   # conversion sur GitHub Actions
tools/export_model.sh            # ou en local (nécessite un CPU avec AVX)
```

Puis mettre à jour la liste des fichiers du modèle dans `sw.js`.

Le zoom numérique (`ZOOM` dans `js/main.js`) agrandit le centre de l'image : les feux lointains
couvrent plus de pixels pour le modèle.

## Mise en ligne

GitHub Pages publie la branche `main` telle quelle (aucun build). Pour une nouvelle version :
changer `VERSION` dans `sw.js` **et** dans `index.html` (`node --test tests/` le vérifie, ainsi
que la présence de chaque fichier dans le cache hors ligne), merger dans `main`, puis créer la
release (`gh release create vX.Y.Z`).

## Licences

- Street Biathlon : **AGPL-3.0** (voir `LICENSE`), imposée par le modèle de détection.
- YOLO11n © Ultralytics, AGPL-3.0.
- TensorFlow.js 4.22.0 (`vendor/`), Apache-2.0.
- Photos de `tests/mire.html` : Wikimedia Commons, licences libres (lien sous chaque photo).
