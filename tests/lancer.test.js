// Lancer de tomate : trajectoire en cloche, et main / tomate construites sous Node (sans WebGL).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.min.js';
import { trajectoire, creerMain, creerTomate, creerLancer, DUREE_VOL } from '../js/lancer.js';

test('trajectoire : part du départ, arrive au point visé, passe au-dessus', () => {
  const depart = { x: 280, y: -600 };
  const arrivee = { x: 187, y: -333 };
  assert.deepEqual(trajectoire(0, depart, arrivee, 200), depart);
  assert.deepEqual(trajectoire(1, depart, arrivee, 200), arrivee);
  const milieu = trajectoire(0.5, depart, arrivee, 200);
  assert.ok(milieu.y > arrivee.y, 'plus haut que l\'arrivée à mi-course');
  assert.ok(trajectoire(1.2, depart, arrivee, 200).y < arrivee.y, 'retombe après l\'arrivée');
});

test('main et tomate : maillages légers', () => {
  for (const objet of [creerMain(), creerTomate()]) {
    let triangles = 0;
    objet.traverse((o) => {
      if (o.isMesh) triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    assert.ok(triangles > 0 && triangles < 3000, `${triangles} triangles`);
  }
});

test('lancer : impact une seule fois au point visé, puis la main revient si une tomate reste', () => {
  const scene = new THREE.Scene();
  const lancer = creerLancer(scene);
  lancer.preparer(true);
  lancer.maj(0, 375, 667);
  assert.ok(lancer.visible, 'main visible au repos');
  let impacts = 0;
  assert.ok(lancer.lancer({ x: 187, y: 333 }, () => { impacts++; return false; }));
  assert.equal(lancer.lancer({ x: 0, y: 0 }, () => {}), false, 'un seul lancer à la fois');
  for (let t = 0; t < 3; t += 1 / 60) lancer.maj(1 / 60, 375, 667);
  assert.equal(impacts, 1);
  assert.equal(lancer.enCours, false);
  assert.ok(lancer.visible, 'main revenue avec une nouvelle tomate');
  lancer.preparer(false);
  assert.equal(lancer.visible, false);
  assert.ok(DUREE_VOL > 0.3 && DUREE_VOL < 1);
});

test('chemin prévu : de la tomate dans la main jusqu\'au point visé, absent pendant un lancer', () => {
  const lancer = creerLancer(new THREE.Scene());
  lancer.preparer(true);
  lancer.maj(0, 375, 667);
  const vise = { x: 187.5, y: 333.5 };
  const chemin = lancer.chemin(vise);
  const depart = chemin(0);
  assert.ok(depart.x > 187.5 && depart.y > 333.5, 'part d\'en bas à droite');
  const arrivee = chemin(1);
  assert.ok(Math.abs(arrivee.x - vise.x) < 1e-6 && Math.abs(arrivee.y - vise.y) < 1e-6);
  assert.ok(chemin(0.5).y < Math.min(depart.y, vise.y), 'passe au-dessus (y écran plus petit)');
  lancer.lancer(vise, () => false);
  assert.equal(lancer.chemin(vise), null);
});
