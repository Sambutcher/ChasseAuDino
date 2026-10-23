// Préparation des modèles 3D, sans navigateur : three.js et GLTFLoader tournent sous Node
// tant qu'aucun rendu WebGL n'est demandé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './aide-three.js';
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { ESPECES } from '../js/especes.js';
import { preparer, creerExplosion, DUREE_EXPLOSION } from '../js/creatures.js';
import { VARIANTES_HUMEUR } from '../js/animation.js';

async function charger(espece) {
  const b = readFileSync(new URL(`../${espece.fichier}`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '');
  return preparer(gltf, espece);
}

for (const espece of Object.values(ESPECES)) {
  test(`${espece.nom} : hauteur 1, posé ou centré, animations prêtes`, async () => {
    const m = await charger(espece);
    m.pivot.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(m.pivot);
    assert.ok(Math.abs(bb.max.y - bb.min.y - 1) < 0.01, `hauteur ${bb.max.y - bb.min.y}`);
    if (espece.vol) assert.ok(Math.abs(bb.min.y + bb.max.y) < 0.01, 'centré verticalement');
    else assert.ok(Math.abs(bb.min.y) < 0.01, 'pieds à y = 0');
    assert.ok(Math.abs(bb.min.x + bb.max.x) < 0.01, 'centré horizontalement');
    assert.ok(m.ratioFace > 0.2 && m.ratioFace < 6, `largeur de face ${m.ratioFace}`);
    assert.ok(m.ratioProfil > 0.3 && m.ratioProfil < 3, `largeur de profil ${m.ratioProfil}`);
    assert.equal(m.mimiques, VARIANTES_HUMEUR);
  });
}

test('créatures statiques : pose en code autour des pieds, retour au neutre à l\'arrêt', async () => {
  const m = await charger(ESPECES.cheval);
  m.demarrer();
  m.fuir();
  m.maj(0.1);
  m.pivot.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(m.pivot);
  assert.ok(bb.min.y > -0.05, `pieds sous le sol (${bb.min.y})`);
  m.arreter();
  m.pivot.updateMatrixWorld(true);
  const repos = new THREE.Box3().setFromObject(m.pivot);
  assert.ok(Math.abs(repos.min.y) < 0.01 && Math.abs(repos.max.y - 1) < 0.01);
});

for (const cle of ['vache', 'chien', 'croissant']) {
  test(`explosion du ${ESPECES[cle].nom} : éclats issus de la créature, effet borné dans le temps`, async () => {
    const m = await charger(ESPECES[cle]);
    m.demarrer();
    m.maj(0.2);
    m.pivot.position.set(200, -400, 0);
    m.pivot.scale.setScalar(300);
    m.pivot.updateMatrixWorld(true);
    const e = creerExplosion(m, { etoile: null, rond: null });
    const eclats = e.groupe.children.find((o) => o.isMesh && o.geometry.attributes.color);
    const p = eclats.geometry.attributes.position;
    let triangles = 0;
    m.pivot.traverse((o) => {
      if (o.isMesh) triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    });
    assert.equal(p.count, triangles * 3, 'tous les triangles de la créature');
    const avant = new THREE.Box3().setFromBufferAttribute(p);
    const h = avant.max.y - avant.min.y;
    assert.ok(h > 250 && h < 320, `à la taille affichée (${h})`);
    assert.ok(e.maj(0.5));
    const apres = new THREE.Box3().setFromBufferAttribute(p);
    assert.ok(apres.getSize(new THREE.Vector3()).length() > avant.getSize(new THREE.Vector3()).length(), 'les éclats s\'écartent');
    let t = 0.5;
    while (e.maj(0.1)) t += 0.1;
    assert.ok(Math.abs(t - DUREE_EXPLOSION) < 0.15, `fin vers ${DUREE_EXPLOSION} s (${t})`);
    e.liberer();
  });
}

test('éclair : épaissi pour ne pas être trop plat, hauteur toujours normalisée', async () => {
  const m = await charger(ESPECES.eclair);
  assert.ok(m.ratioFace < 3.5, `largeur de face ${m.ratioFace}`);
  m.pivot.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(m.pivot);
  assert.ok(Math.abs(bb.max.y - bb.min.y - 1) < 0.01);
});
