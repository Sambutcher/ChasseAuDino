# Chasse au dino — notes pour Claude

- Dérivé de Street Biathlon (`~/Code/street-biathlon`) : même socle (course GPS, caméra, détection
  YOLO11n, flux optique, suivi, PWA). Un correctif du socle vaut souvent pour les deux projets.
- PWA **vanilla JS sans build** (modules ES), cible iPhone SE 3ᵉ gén. (Safari), hors ligne.
  Ne pas introduire de bundler ni de framework. Licence AGPL-3.0.
- Partie = course (100 m à vol d'oiseau au GPS, caméra éteinte) → « Position de tir » → **une seule
  cartouche** : la créature touchée explose, ratée elle s'enfuit → course… `?simgps`, `?debug`.
- Voitures (COCO 2) → héros / squelettes KayKit (CC0) selon la couleur de la carrosserie
  (`js/couleur.js`, `PERSONNAGES_VOITURE`) ; modèles allégés par `tools/alleger_kaykit.py`.
- Orientation (profil/face, regard gauche/droite) : posture RTMPose AP-10K des animaux
  (`js/posture.js`, modèle `models/rtmpose-ap10k/` converti par le workflow `export-posture.yml`),
  sinon forme du rectangle et regard vers le centre ; pas de modèle d'orientation pour les voitures
  (aucun libre et léger trouvé). Espèces désignées par une clé (`'vache'`, `'mage'`…).
- Animaux COCO détectés par le YOLO11n existant (aucun réentraînement), remplacés par une créature 3D
  (table `ESPECES` de `js/especes.js`) : chat→lapin, vache→dinosaure, cheval→licorne (kawaii) ;
  chien→loup, mouton→dragon (méchants, yeux rougeoyants : `yeux` dans ESPECES). Modèles Quaternius CC0 dans `models/creatures/`.
  La licorne est le cheval recoloré, avec corne ajoutée en code (`licorne()` de `js/creatures.js`).
- 3D : three.js 0.170.0 copié dans `vendor/` (imports réécrits en relatif, pas d'import map).
  Trois canvas superposés : `#jeu` (vidéo 2D), `#creatures` (WebGL), `#hud` (interface 2D, reçoit les taps).
- Logique pure (`js/game.js`, `js/especes.js`, `js/geometry.js`, `js/tracker.js`, `js/flow.js`,
  `js/course.js`) et préparation des modèles (`preparer`, `creerExplosion` de `js/creatures.js`,
  three.js tourne sous Node sans WebGL) testées par `node --test tests/` (Node 18 apt, pas de npm).
- `tests/bestiaire.html` : bac à sable des créatures (mimiques, explosion, fuite, tir) sans caméra.
  `tests/mire.html` : détection sur 20 vraies photos d'animaux (Wikimedia Commons, en ligne).
- Tout fichier servi doit figurer dans `FICHIERS` de `sw.js` ; `VERSION` (sw.js + index.html)
  change à chaque mise en ligne. `tests/pwa.test.js` vérifie les deux.
- Dev sur iPhone : `python3 tools/serve.py` (HTTPS auto-signé, IP locale 192.168.1.147:8443).
- Mise en ligne : GitHub Pages sur `main` (https://sambutcher.github.io/ChasseAuDino/),
  merge fait par Samuel ; release `vX.Y.Z` ensuite.
- Ne pas tester les pages dans Chromium : Samuel teste lui-même (navigateur, iPhone).
- Langue du code et des textes : français.
