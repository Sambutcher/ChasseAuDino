// Cohérence de la PWA : version unique, et tout fichier chargé par l'appli présent dans le cache
// hors ligne du service worker (sinon le jeu casse en mode avion).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const lire = (chemin) => readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8');
const sw = lire('sw.js');
const index = lire('index.html');
const fichiersCache = [...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);

test('même version dans sw.js et index.html', () => {
  const version = sw.match(/const VERSION = '([^']+)'/)[1];
  assert.ok(index.includes(`v${version}`), `index.html doit afficher v${version}`);
});

test('fichiers référencés par index.html et le manifest dans le cache', () => {
  const refs = [...index.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const manifest = JSON.parse(lire('manifest.webmanifest'));
  for (const f of [...refs, ...manifest.icons.map((i) => i.src)]) {
    assert.ok(fichiersCache.includes(f), `${f} manque dans FICHIERS de sw.js`);
  }
});

test('modules js/ et fichiers du modèle dans le cache', () => {
  const dossier = (d) => readdirSync(new URL(`../${d}/`, import.meta.url)).map((f) => `${d}/${f}`);
  for (const f of dossier('js')) assert.ok(fichiersCache.includes(f), `${f} manque dans FICHIERS de sw.js`);
  const modele = JSON.parse(lire('models/yolo11n/model.json'));
  for (const f of modele.weightsManifest.flatMap((g) => g.paths)) {
    assert.ok(fichiersCache.includes(`models/yolo11n/${f}`), `models/yolo11n/${f} manque dans FICHIERS de sw.js`);
  }
});

test('le cache ne liste que des fichiers existants', () => {
  for (const f of fichiersCache.filter((f) => f !== './')) {
    assert.doesNotThrow(() => readFileSync(new URL(`../${f}`, import.meta.url)), `${f} n'existe pas`);
  }
});
