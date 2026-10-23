# Chasse aux bébêtes (dépôt ChasseAuxBebetes, ex-ChasseAuDino) — notes pour Claude

- Dérivé de Street Biathlon (`~/Code/street-biathlon`) : même socle (course GPS, caméra, détection
  YOLO11n, flux optique, suivi, PWA). Un correctif du socle vaut souvent pour les deux projets.
- PWA **vanilla JS sans build** (modules ES), cible iPhone SE 3ᵉ gén. (Safari), hors ligne.
  Ne pas introduire de bundler ni de framework. Licence AGPL-3.0.
- Partie = course (100 m à vol d'oiseau au GPS, caméra éteinte) → « Lancer de tomate » → **une seule
  tomate** (depuis 1.2.0, à la place de la cartouche) : une main 3D (`js/lancer.js`, géométries
  three.js simples dans la scène des créatures) la lance en cloche vers le viseur ; à l'impact, la
  créature touchée explose, ratée elle s'enfuit → course… Dans le code, `cartouches` compte les tomates. Bouton « Skip » sur
  l'écran de course : tir sans courir. Pas de mode debug ni de simulation GPS.
- Branches : `v1-stable-sans-posture` (par défaut, en ligne ; depuis 1.4.0 elle a la posture, nom conservé) ;
  `avec-posture` = essais de posture RTMPose (orientation des créatures), abandonnés : saturait
  la mémoire de l'iPhone SE en WebGL comme en WebAssembly. Espèces désignées par une clé
  (`'vache'`, `'mage'`…).
- Animaux COCO détectés par le YOLO11n existant (aucun réentraînement), remplacés par une créature 3D
  kawaii (table `ESPECES` de `js/especes.js`) : chat→chaton, chien→chiot, cheval→licorne,
  mouton→panda, vache→dragon. Maillages statiques (sans squelette) allégés à ~8–20 k triangles et
  texture 512 px par `tools/alleger_modeles.py` (venv hors dépôt : numpy, meshoptimizer, pillow ;
  sources dans `Téléchargements/`, ignoré par git), animés **en code** par `js/animation.js`
  (respiration, saut/tortillement, fuite en sautillant). Avant du modèle = +Z.
- **Posture des animaux (1.4.0)** : `yolo11n-pose` entraîné sur Animal Pose (Kaggle,
  `tools/preparer_pose.py` + `tools/entrainer_pose.py`, poids dans `pose/best.pt`, converti en TF.js par
  le workflow `export-pose.yml` dans `models/pose/`, entrée carrée 256 px, ~6 Mo). `js/pose.js` l'exécute
  sur un carré autour de l'animal suivi toutes les 300 ms (une seule inférence à la fois avec la
  détection) ; `js/posture.js` (pur) déduit profil, sens et dos des points clés, le lacet est passé à
  `creatures.montrer`. Sans modèle ou sans estimation : créature tournée vers le centre. Pas de
  repli par ratio de boîte. Voitures sans orientation tant que l'étape 3 n'est pas faite.
- Voitures (COCO 2) → un aliment tiré au hasard à chaque apparition (burger, croissant, éclair,
  frites, sushi) ; .glb convertis par `tools/convertir_nourriture.py`.
- 3D : three.js 0.170.0 copié dans `vendor/` (imports réécrits en relatif, pas d'import map).
  Trois canvas superposés : `#jeu` (vidéo 2D), `#creatures` (WebGL), `#hud` (interface 2D, reçoit les taps).
- **Mémoire graphique de l'iPhone SE à la limite** (TF.js + three.js) : TF.js libère ses textures
  aussitôt (`WEBGL_DELETE_TEXTURE_THRESHOLD` 0), créatures sans anticrénelage, densité ≤ 1,5. Si
  un contexte WebGL est perdu (symptôme : image réduite en haut à gauche, détection arrêtée), le
  jeu recharge la page. Tout ajout lourd en mémoire graphique est à proscrire.
- Vidéo : toujours dessinée entière (`placementVideo` de `js/geometry.js`), jamais découpée.
  Ne pas surveiller `video.currentTime` : avec un flux caméra, Safari iOS ne le fait pas avancer
  de façon fiable (un « gardien » basé dessus redémarrait la caméra sans cesse).
- Logique pure (`js/game.js`, `js/especes.js`, `js/posture.js`, `js/animation.js`, `js/geometry.js`, `js/tracker.js`,
  `js/flow.js`, `js/course.js`) et préparation des modèles (`preparer`, `creerExplosion` de
  `js/creatures.js`, three.js sous Node sans WebGL, `tests/aide-three.js` pour les textures)
  testées par `node --test tests/` (Node 18 apt, pas de npm).
- Tout fichier servi doit figurer dans `FICHIERS` de `sw.js` ; `VERSION` (sw.js + index.html)
  change à chaque mise en ligne. `tests/pwa.test.js` vérifie les deux. Depuis 1.1.2, `sw.js` est
  vérifié à chaque ouverture et la page se recharge quand une nouvelle version prend la main.
- Dev sur iPhone : `python3 tools/serve.py` (HTTPS auto-signé, IP locale 192.168.1.147:8443) ;
  tester sur Pages en **navigation privée** pour éviter le cache hors ligne.
- Mise en ligne : GitHub Pages sur la branche `v1-stable-sans-posture`
  (https://sambutcher.github.io/ChasseAuxBebetes/), publication automatique à chaque push.
  L'ancienne adresse …/ChasseAuDino/ ne redirige pas (dépôt renommé le 2026-10-23).
- Ne pas tester les pages dans Chromium : Samuel teste lui-même (navigateur, iPhone).
- Langue du code et des textes : français.
