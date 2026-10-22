# Street Biathlon — notes pour Claude

- PWA **vanilla JS sans build** (modules ES), cible iPhone SE 3ᵉ gén. (Safari), hors ligne.
  Ne pas introduire de bundler ni de framework. Licence AGPL-3.0.
- Partie = cycle course (100 m à vol d'oiseau au GPS, caméra éteinte) → bouton « Position de tir »
  → tir de 3 balles → course… Tester sans courir avec `?simgps`, diagnostic avec `?debug`.
- Détection : YOLO11n converti en TF.js, `vendor/tf.min.js` 4.22.0. Le PC de dev n'a pas l'AVX :
  la conversion passe par le workflow manuel `export-model.yml` (ultralytics < 8.4).
- Logique pure (`js/game.js`, `js/geometry.js`, `js/tracker.js`, `js/flow.js`, `js/course.js`)
  testée par `node --test tests/` (Node 18 apt, pas de npm). Garder le DOM et `tf` hors de ces modules.
- Tout fichier servi doit figurer dans `FICHIERS` de `sw.js` ; `VERSION` (sw.js + index.html)
  change à chaque mise en ligne. `tests/pwa.test.js` vérifie les deux.
- Dev sur iPhone : `python3 tools/serve.py` (HTTPS auto-signé, IP locale 192.168.1.147:8443).
- Mise en ligne : GitHub Pages sur `main` (https://sambutcher.github.io/StreetBiathlon/),
  merge fait par Samuel ; release `vX.Y.Z` ensuite.
- Feuille de route : v1.0.0 = tir + course. À venir : score/chrono (pénalités ?), historique.
- Ne pas tester les pages dans Chromium : Samuel teste lui-même (navigateur, iPhone).
- Langue du code et des textes : français.
