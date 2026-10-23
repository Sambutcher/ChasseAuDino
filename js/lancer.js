// Lancer de tomate (three.js), dans la scène des créatures : une main attend en bas à droite,
// tomate dans la paume, puis la lance en cloche vers le viseur. Géométries simples et matériaux
// mats : presque rien en mémoire graphique. Coordonnées de la scène : point écran (x, y) = (x, -y).
import * as THREE from '../vendor/three.module.min.js';

const ELAN = 0.14; // s : la main descend et se cambre
const BRAS = 0.14; // s : la main remonte et lâche la tomate
export const DUREE_VOL = 0.55; // s : du lâcher à l'impact au viseur
const CHUTE = 0.3; // s : une tomate qui manque sa cible continue sa course
const RETOUR = 0.4; // s : la main redescend hors de l'écran après le lâcher
const Z_MAIN = 3000; // devant les créatures (posées en z = 0)
const Z_TOMATE = 1500;
const RAYON_TOMATE = 0.36; // en hauteurs de paume

// Position de la tomate en vol, u de 0 (lâcher) à 1 (impact) et au-delà (elle continue de tomber) :
// ligne droite du départ à l'arrivée, relevée d'une parabole de hauteur `fleche` (coordonnées
// de la scène, y vers le haut).
export function trajectoire(u, depart, arrivee, fleche) {
  return {
    x: depart.x + (arrivee.x - depart.x) * u,
    y: depart.y + (arrivee.y - depart.y) * u + fleche * 4 * u * (1 - u),
  };
}

// Hauteur de la cloche : un tiers de l'écran, plus quand la cible est au-dessus du départ.
export function fleche(depart, arrivee, hauteur) {
  return hauteur * 0.3 + Math.max(0, arrivee.y - depart.y) * 0.3;
}

// Main droite vue de l'avant, paume vers la caméra, doigts vers le haut (hauteur de paume 1,
// origine au centre de la paume). La tomate se loge devant la paume, entre les doigts repliés.
export function creerMain() {
  const peau = new THREE.MeshLambertMaterial({ color: '#f2c29b' });
  const main = new THREE.Group();
  const paume = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), peau);
  paume.scale.set(0.9, 1, 0.38);
  main.add(paume);
  const avantBras = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 2.4, 14), peau);
  avantBras.position.set(0, -1.45, -0.05);
  main.add(avantBras);

  const doigt = new THREE.CapsuleGeometry(0.1, 0.36, 4, 8);
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(doigt, peau);
    const repli = 0.75; // vers l'avant, autour de la tomate
    const base = 0.42 - Math.abs(i - 1.5) * 0.06; // majeur et annulaire plus longs
    d.position.set(-0.3 + i * 0.2, base + 0.28 * Math.cos(repli), 0.28 * Math.sin(repli));
    d.rotation.x = repli;
    main.add(d);
  }
  const pouce = new THREE.Mesh(doigt, peau);
  pouce.position.set(0.48, -0.02, 0.2);
  pouce.rotation.set(0.6, 0, -0.8);
  main.add(pouce);
  return main;
}

// Tomate simplifiée de rayon 1 : sphère un peu aplatie, calice de cinq sépales et queue.
export function creerTomate() {
  const tomate = new THREE.Group();
  const fruit = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshLambertMaterial({ color: '#e0301e' }));
  fruit.scale.set(1, 0.82, 1);
  tomate.add(fruit);
  const vert = new THREE.MeshLambertMaterial({ color: '#3f9b2f' });
  const sepale = new THREE.BoxGeometry(0.55, 0.06, 0.16);
  sepale.translate(0.27, 0, 0);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(sepale, vert);
    s.position.y = 0.8;
    s.rotation.set(0, (i * 2 * Math.PI) / 5, -0.3); // retombe sur le fruit
    tomate.add(s);
  }
  const queue = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 6), vert);
  queue.position.y = 0.95;
  tomate.add(queue);
  return tomate;
}

const lisse = (k) => k * k * (3 - 2 * k);

export function creerLancer(scene) {
  const main = creerMain();
  const tomate = creerTomate();
  const support = new THREE.Group(); // place et taille de la main à l'écran
  support.add(main);
  support.visible = false;
  scene.add(support);
  const placerTomate = () => {
    main.add(tomate);
    tomate.position.set(0, 0.22, 0.42);
    tomate.rotation.set(0.4, 0, 0);
    tomate.scale.setScalar(RAYON_TOMATE);
    tomate.visible = true;
  };
  placerTomate();

  let pret = false; // une tomate est disponible
  let t = null; // secondes depuis le début du lancer, null au repos
  let vol = null; // { depart, arrivee, fleche, s0, s1, impact, touche }
  let quandImpact = null;
  let hauteurEcran = 0;

  // Main au repos, posée en bas à droite, paume tournée vers le haut, inclinée vers le centre.
  function poser(largeur, hauteur) {
    const h = Math.min(largeur, hauteur) * 0.3;
    support.position.set(largeur * 0.74, -(hauteur - h * 0.8), Z_MAIN);
    support.scale.setScalar(h);
    main.position.set(0, 0, 0);
    main.rotation.set(-0.6, -0.25, 0.35);
  }

  // La tomate est disponible : la main l'attend (sans effet pendant un lancer).
  function preparer(disponible) {
    pret = disponible;
    if (t === null) support.visible = pret;
  }

  // Lance la tomate vers `point` (écran). `impact()` est appelé quand elle y arrive et renvoie
  // true si elle a touché (elle disparaît alors dans l'explosion), false sinon (elle continue).
  function lancer(point, impact) {
    if (t !== null || !pret) return false;
    t = 0;
    vol = { arrivee: { x: point.x, y: -point.y } };
    quandImpact = impact;
    support.visible = true;
    return true;
  }

  // Trajet prévu de la tomate (pour l'arc pointillé du viseur) : fonction de u (0 → 1) donnant un
  // point écran, de la tomate dans la main jusqu'à `point`. null si la main n'attend pas.
  function chemin(point) {
    if (t !== null || !support.visible) return null;
    support.updateMatrixWorld(true);
    const p = tomate.getWorldPosition(new THREE.Vector3());
    const depart = { x: p.x, y: p.y };
    const arrivee = { x: point.x, y: -point.y };
    const f = fleche(depart, arrivee, hauteurEcran);
    return (u) => {
      const q = trajectoire(u, depart, arrivee, f);
      return { x: q.x, y: -q.y };
    };
  }

  function maj(dt, largeur, hauteur) {
    hauteurEcran = hauteur;
    poser(largeur, hauteur);
    if (t === null) return;
    t += dt;
    // La main : élan vers le bas en se cambrant, puis remontée en fouettant du poignet.
    if (t < ELAN) {
      const k = lisse(t / ELAN);
      main.position.y = -0.3 * k;
      main.rotation.x = -0.6 + 0.4 * k;
    } else if (t < ELAN + BRAS) {
      const k = lisse((t - ELAN) / BRAS);
      main.position.set(-0.4 * k, -0.3 + 0.8 * k, 0);
      main.rotation.x = -0.2 - 0.9 * k;
    } else {
      const k = lisse(Math.min(1, (t - ELAN - BRAS) / RETOUR));
      main.position.set(-0.4, 0.5 - 3 * k, 0);
      main.rotation.x = -1.1;
    }

    // Lâcher : la tomate quitte la main en gardant sa place et sa taille à l'écran.
    if (t >= ELAN + BRAS && !vol.depart) {
      scene.updateMatrixWorld(true);
      scene.attach(tomate);
      vol.depart = { x: tomate.position.x, y: tomate.position.y };
      vol.s0 = tomate.scale.x;
      vol.s1 = Math.max(6, Math.min(largeur, hauteur) * 0.03);
      vol.fleche = fleche(vol.depart, vol.arrivee, hauteur);
    }
    if (vol.depart) {
      const u = (t - ELAN - BRAS) / DUREE_VOL;
      if (u >= 1 && vol.touche === undefined) {
        vol.touche = Boolean(quandImpact?.());
        if (vol.touche) tomate.visible = false;
      }
      const p = trajectoire(u, vol.depart, vol.arrivee, vol.fleche);
      tomate.position.set(p.x, p.y, Z_TOMATE);
      tomate.scale.setScalar(vol.s0 * (vol.s1 / vol.s0) ** Math.min(u, 1.3));
      tomate.rotation.x -= dt * 9; // vrille vers l'avant
      if (u > 1 + CHUTE / DUREE_VOL) tomate.visible = false;
    }

    if (t > ELAN + BRAS + Math.max(RETOUR, DUREE_VOL + CHUTE)) {
      t = null;
      vol = null;
      quandImpact = null;
      placerTomate();
      main.position.set(0, 0, 0);
      support.visible = pret;
    }
  }

  return {
    preparer, lancer, maj, chemin,
    get visible() { return support.visible || (tomate.parent === scene && tomate.visible); },
    get enCours() { return t !== null; },
  };
}
