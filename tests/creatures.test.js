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
    assert.ok(m.ratioFace > 0.2 && m.ratioFace < 2, `largeur de face ${m.ratioFace}`);
    assert.ok(m.ratioProfil > 0.3 && m.ratioProfil < 3, `largeur de profil ${m.ratioProfil}`);
    assert.ok(m.attente && m.fuite, 'attente et fuite');
    assert.equal(m.humeurs.length, espece.clips.humeurs.length);
  });
}

test('licorne : corne dorée sur la tête, pointée vers le haut', async () => {
  const m = await charger(ESPECES.cheval);
  m.pivot.updateMatrixWorld(true);
  const corne = m.pivot.getObjectByName('Corne');
  assert.ok(corne, 'corne ajoutée');
  assert.equal(corne.parent.name, 'Head', 'attachée à l\'os de la tête');
  const base = corne.getWorldPosition(new THREE.Vector3());
  const pointe = corne.localToWorld(new THREE.Vector3(0, corne.geometry.parameters.height, 0));
  assert.ok(pointe.y > base.y, 'pointe au-dessus de la base');
  assert.ok(base.y > 0.7, `corne en haut de la créature (y ${base.y})`);
});

for (const espece of Object.values(ESPECES).filter((e) => e.ton === 'mechant')) {
  test(`${espece.nom} : yeux rougeoyants`, async () => {
    const m = await charger(espece);
    const { materiau, objet } = espece.yeux ?? { materiau: 'Eye_White' };
    const yeux = [];
    m.pivot.traverse((o) => {
      if (!o.isMesh) return;
      if (objet) {
        if (o.name.includes(objet)) yeux.push(...[].concat(o.material));
      } else yeux.push(...[].concat(o.material).filter((x) => x.name === materiau));
    });
    assert.ok(yeux.length > 0, 'matériau des yeux trouvé');
    assert.ok(yeux.every((x) => x.emissiveIntensity === 2 && x.emissive.r > 0.5));
  });
}

test('loup : robe sombre', async () => {
  const m = await charger(ESPECES.chien);
  const robes = [];
  m.pivot.traverse((o) => {
    if (o.isMesh) robes.push(...[].concat(o.material).filter((x) => x.name === 'Main'));
  });
  assert.ok(robes.length > 0 && robes.every((x) => x.color.getHexString() === new THREE.Color('#2e3136').getHexString()));
});

for (const cle of ['vache', 'mouton', 'chevalier']) {
  test(`explosion du ${ESPECES[cle].nom} : éclats issus de la créature, effet borné dans le temps`, async () => {
    const m = await charger(ESPECES[cle]);
    m.attente.play();
    m.mixer.update(0.2);
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

test('squelette : seul l\'objet des yeux rougeoie, le corps garde sa texture', async () => {
  const m = await charger(ESPECES['squelette-mage']);
  const corps = m.pivot.getObjectByName('Skeleton_Mage_Body');
  assert.ok(corps && corps.material.emissiveIntensity !== 2);
});

test('chevalier : une seule épée et un seul bouclier', async () => {
  const m = await charger(ESPECES.chevalier);
  const objets = [];
  m.pivot.traverse((o) => { if (o.isMesh) objets.push(o.name); });
  assert.deepEqual(objets.filter((n) => /Sword|Shield/.test(n)).sort(), ['1H_Sword', 'Round_Shield']);
});
