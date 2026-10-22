# Chasse aux bébêtes (dépôt ChasseAuDino) — notes pour Claude

- Dérivé de Street Biathlon (`~/Code/street-biathlon`) : même socle (course GPS, caméra, détection
  YOLO11n, flux optique, suivi, PWA). Un correctif du socle vaut souvent pour les deux projets.
- PWA **vanilla JS sans build** (modules ES), cible iPhone SE 3ᵉ gén. (Safari), hors ligne.
  Ne pas introduire de bundler ni de framework. Licence AGPL-3.0.
- Partie = course (100 m à vol d'oiseau au GPS, caméra éteinte) → « Position de tir » → **une seule
  cartouche** : la créature touchée explose, ratée elle s'enfuit → course… Bouton « Skip » sur
  l'écran de course : tir sans courir. Pas de mode debug ni de simulation GPS.
- Branches : `v1-stable-sans-posture` (par défaut, en ligne) = YOLO seul, sans orientation ;
  `avec-posture` = essais de posture RTMPose (orientation des créatures), abandonnés : saturait
  la mémoire de l'iPhone SE en WebGL comme en WebAssembly. Espèces désignées par une clé
  (`'vache'`, `'mage'`…).
- Animaux COCO détectés par le YOLO11n existant (aucun réentraînement), remplacés par une créature 3D
  (table `ESPECES` de `js/especes.js`) : chat→lapin, vache→dinosaure, cheval→licorne (kawaii) ;
  chien→loup, mouton→dragon (méchants, yeux rougeoyants : `yeux` dans ESPECES). Modèles
  Quaternius CC0 dans `models/creatures/`. La licorne est le cheval recoloré, avec corne ajoutée
  en code (`licorne()` de `js/creatures.js`).
- Voitures (COCO 2) → héros / squelettes KayKit (CC0) selon la couleur de la carrosserie
  (`js/couleur.js`, `PERSONNAGES_VOITURE`) ; modèles allégés par `tools/alleger_kaykit.py`.
- 3D : three.js 0.170.0 copié dans `vendor/` (imports réécrits en relatif, pas d'import map).
  Trois canvas superposés : `#jeu` (vidéo 2D), `#creatures` (WebGL), `#hud` (interface 2D, reçoit les taps).
- **Mémoire graphique de l'iPhone SE à la limite** (TF.js + three.js) : TF.js libère ses textures
  aussitôt (`WEBGL_DELETE_TEXTURE_THRESHOLD` 0), créatures sans anticrénelage, densité ≤ 1,5. Si
  un contexte WebGL est perdu (symptôme : image réduite en haut à gauche, détection arrêtée), le
  jeu recharge la page. Tout ajout lourd en mémoire graphique est à proscrire.
- Vidéo : toujours dessinée entière (`placementVideo` de `js/geometry.js`), jamais découpée.
  Ne pas surveiller `video.currentTime` : avec un flux caméra, Safari iOS ne le fait pas avancer
  de façon fiable (un « gardien » basé dessus redémarrait la caméra sans cesse).
- Logique pure (`js/game.js`, `js/especes.js`, `js/couleur.js`, `js/geometry.js`, `js/tracker.js`,
  `js/flow.js`, `js/course.js`) et préparation des modèles (`preparer`, `creerExplosion` de
  `js/creatures.js`, three.js sous Node sans WebGL, `tests/aide-three.js` pour les textures)
  testées par `node --test tests/` (Node 18 apt, pas de npm).
- Tout fichier servi doit figurer dans `FICHIERS` de `sw.js` ; `VERSION` (sw.js + index.html)
  change à chaque mise en ligne. `tests/pwa.test.js` vérifie les deux. Depuis 1.1.2, `sw.js` est
  vérifié à chaque ouverture et la page se recharge quand une nouvelle version prend la main.
- Dev sur iPhone : `python3 tools/serve.py` (HTTPS auto-signé, IP locale 192.168.1.147:8443) ;
  tester sur Pages en **navigation privée** pour éviter le cache hors ligne.
- Mise en ligne : GitHub Pages sur la branche `v1-stable-sans-posture`
  (https://sambutcher.github.io/ChasseAuDino/), publication automatique à chaque push.
- Ne pas tester les pages dans Chromium : Samuel teste lui-même (navigateur, iPhone).
- Langue du code et des textes : français.
