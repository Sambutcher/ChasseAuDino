// Créatures 3D (three.js) dessinées par-dessus la vidéo, à la place de l'animal suivi.
// Canvas WebGL transparent, caméra orthographique en points CSS : un point écran (x, y)
// correspond au point 3D (x, -y, 0). Une seule créature visible à la fois.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { ESPECES } from './especes.js';
import { lisserVers } from './geometry.js';
import { creerLancer } from './lancer.js';
import { creerAnimation, pose, VARIANTES_HUMEUR } from './animation.js';

export const DUREE_EXPLOSION = 1.8; // s
// Lissage de l'affichage : la boîte suivie avance par à-coups (flux optique en pixels entiers
// d'une image réduite, recalages des détections), la créature la suit en douceur.
const TAU_POSITION = 0.12; // s
const TAU_TAILLE = 0.3; // s
const TAU_LACET = 0.25; // s : la créature pivote en douceur quand elle traverse l'écran
const SAUT = 1.5; // écart (en hauteurs de créature) au-delà duquel on se recale d'un coup
const TRIANGLES_PAR_ECLAT = 4;
const TOLERANCE_TIR = 8; // px : une tomate qui frôle la silhouette compte
const VITESSE_FUITE = 1.2; // largeurs d'écran par seconde

const PALETTES = {
  kawaii: { flash: '#fff0fa', particules: ['#ff7eb9', '#ffd23f', '#7afcff', '#c792ff', '#ffffff'] },
  mechant: { flash: '#ffb347', particules: ['#ffdd55', '#ff8a00', '#ff3b00', '#b31b00'], fumee: ['#2a2a2a', '#444', '#5a5248'] },
};

// options.base : préfixe des chemins des modèles (page hors racine) ;
// options.quandHumeur(espece) : la créature fait une mimique (pour le son).
export async function creerCreatures(canvas, { base = '', quandHumeur = () => {} } = {}) {
  // Sans anticrénelage et densité plafonnée : la mémoire graphique de l'iPhone SE est à la limite.
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10000, 10000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x554466, 2.2));
  const soleil = new THREE.DirectionalLight(0xffffff, 2.4);
  soleil.position.set(0.4, 1, 0.9);
  scene.add(soleil);

  let largeur = 0;
  let hauteur = 0;
  function redimensionner() {
    largeur = window.innerWidth;
    hauteur = window.innerHeight;
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.setSize(largeur, hauteur, false);
    camera.right = largeur;
    camera.bottom = -hauteur;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', redimensionner);
  redimensionner();

  const chargeur = new GLTFLoader();
  const modeles = {};
  await Promise.all(Object.entries(ESPECES).map(async ([classe, espece]) => {
    const gltf = await chargeur.loadAsync(base + espece.fichier);
    modeles[classe] = preparer(gltf, espece);
    scene.add(modeles[classe].pivot);
  }));

  const textures = { etoile: texture(dessinerEtoile), rond: texture(dessinerRond) };
  const lancer = creerLancer(scene); // main et tomate

  let courante = null; // modèle affiché
  let mode = 'cache'; // 'suivi' | 'fuite' | 'explosion' | 'cache'
  let prochaineHumeur = 0;
  let tPrec = null;
  let fuite = null; // { sens, delai }
  let explosion = null;
  let aEffacer = false; // une image vide reste à rendre
  let affiche = null; // { x, y, s, lacet, t } : placement lissé de la créature courante

  function choisir(cle, t) {
    const m = modeles[cle];
    if (!m || m === courante) return m;
    cacher();
    courante = m;
    affiche = null;
    m.pivot.visible = true;
    m.demarrer();
    prochaineHumeur = t + delaiHumeur(m.espece);
    return m;
  }

  // Créature posée sur la boîte écran de la cible : pieds en bas (ou au centre si elle vole),
  // hauteur de la boîte, largeur bornée, légèrement tournée vers le centre de l'écran.
  function montrer(cle, boite, t = performance.now()) {
    if (mode === 'fuite' || mode === 'explosion') return;
    const m = choisir(cle, t);
    if (!m) return;
    mode = 'suivi';
    const x = boite.x + boite.w / 2;
    const y = boite.y + boite.h;
    const versCentre = Math.max(-1, Math.min(1, (largeur / 2 - x) / (largeur / 2)));
    const l = 0.6 * versCentre;
    // Largeur de la créature (en hauteurs) sous cet angle, pour borner sa taille à la boîte.
    const ratio = m.ratioFace * Math.abs(Math.cos(l)) + m.ratioProfil * Math.abs(Math.sin(l));
    const s = Math.max(40, Math.min(boite.h * 1.05, (boite.w * 1.6) / ratio));
    if (!affiche || Math.hypot(x - affiche.x, y - affiche.y) > affiche.s * SAUT) {
      affiche = { x, y, s, lacet: l, t };
    } else {
      const dt = Math.min(0.1, Math.max(0, (t - affiche.t) / 1000));
      affiche = {
        x: lisserVers(affiche.x, x, dt, TAU_POSITION),
        y: lisserVers(affiche.y, y, dt, TAU_POSITION),
        s: lisserVers(affiche.s, s, dt, TAU_TAILLE),
        lacet: lisserVers(affiche.lacet, l, dt, TAU_LACET),
        t,
      };
    }
    m.pivot.position.set(affiche.x, -affiche.y, 0);
    m.pivot.scale.setScalar(affiche.s);
    m.pivot.rotation.set(0.12, affiche.lacet, 0);
  }

  function cacher() {
    if (courante) {
      courante.pivot.visible = false;
      courante.arreter();
      courante = null;
      aEffacer = true;
    }
    if (explosion) {
      explosion.liberer();
      explosion = null;
    }
    fuite = null;
    affiche = null;
    mode = 'cache';
  }

  // La tomate arrivée au viseur (point écran) touche-t-elle la silhouette de la créature ?
  const rayon = new THREE.Raycaster();
  const dirRayon = new THREE.Vector3(0, 0, -1);
  function touche(point) {
    if (mode !== 'suivi' || !courante) return false;
    scene.updateMatrixWorld(true);
    courante.pivot.traverse((o) => {
      if (o.isSkinnedMesh) {
        o.boundingSphere = null; // recalculés dans la pose courante
        o.boundingBox = null;
      }
    });
    const d = TOLERANCE_TIR;
    const decalages = [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]];
    return decalages.some(([dx, dy]) => {
      rayon.set(new THREE.Vector3(point.x + dx, -(point.y + dy), 5000), dirRayon);
      return rayon.intersectObject(courante.pivot, true).length > 0;
    });
  }

  function exploser() {
    if (mode !== 'suivi' || !courante) return;
    mode = 'explosion';
    courante.pivot.updateMatrixWorld(true);
    explosion = creerExplosion(courante, textures);
    scene.add(explosion.groupe);
    courante.pivot.visible = false;
  }

  // La créature part en courant (en volant : vers le haut) du côté où elle regarde, ou à défaut
  // vers le bord le plus proche.
  function fuir() {
    if (mode !== 'suivi' || !courante) return;
    mode = 'fuite';
    const regard = Math.abs(courante.pivot.rotation.y) > 0.3 ? Math.sign(courante.pivot.rotation.y) : 0;
    fuite = { sens: regard || (courante.pivot.position.x < largeur / 2 ? -1 : 1), delai: 0.2 };
    courante.fuir();
  }

  function humeur(t) {
    const m = courante;
    if (mode !== 'suivi' || t < prochaineHumeur || !m.mimiques) return;
    m.mimique(Math.floor(Math.random() * m.mimiques));
    prochaineHumeur = t + delaiHumeur(m.espece);
    quandHumeur(m.espece);
  }

  function avancerFuite(dt) {
    const p = courante.pivot;
    const cible = fuite.sens * Math.PI / 2;
    p.rotation.y += (cible - p.rotation.y) * Math.min(1, dt * 12);
    fuite.delai -= dt;
    if (fuite.delai > 0) return;
    const v = largeur * VITESSE_FUITE * dt;
    p.position.x += fuite.sens * v;
    const s = p.scale.x;
    if (p.position.x < -s || p.position.x > largeur + s || -p.position.y < -s) p.visible = false;
  }

  // À chaque image (t en ms, horloge de requestAnimationFrame).
  function dessiner(t) {
    const dt = tPrec === null ? 0 : Math.min(0.1, (t - tPrec) / 1000);
    tPrec = t;
    lancer.maj(dt, largeur, hauteur); // avant la créature : l'impact peut la faire exploser
    if (courante) {
      courante.maj(dt);
      humeur(t);
      if (mode === 'fuite') avancerFuite(dt);
    }
    if (explosion && !explosion.maj(dt)) {
      explosion.liberer();
      explosion = null;
    }
    const visible = (courante && courante.pivot.visible) || explosion || lancer.visible;
    if (!visible && !aEffacer) return;
    renderer.render(scene, camera);
    aEffacer = !!visible;
  }

  return {
    montrer, cacher, touche, exploser, fuir, dessiner,
    preparerTomate: lancer.preparer, lancerTomate: lancer.lancer, cheminTomate: lancer.chemin,
    get lancerEnCours() { return lancer.enCours; },
  };
}

function delaiHumeur(espece) {
  return (espece.ton === 'kawaii' ? 2500 : 3500) + Math.random() * 2500;
}

// Modèle normalisé : hauteur 1, origine au pied, animé en code
// (js/animation.js) autour des pieds. Interface : demarrer(), mimique(i) parmi `mimiques`,
// fuir(), maj(dt), arreter().
export function preparer(gltf, espece) {
  const modele = gltf.scene;
  modele.traverse((o) => {
    if (o.isMesh) o.frustumCulled = false;
  });
  // Aliment trop plat : on l'épaissit (hauteur et profondeur) avant de le mesurer.
  if (espece.epaisseur) modele.scale.set(1, espece.epaisseur, espece.epaisseur);
  const bb = new THREE.Box3().setFromObject(modele);
  const taille = bb.getSize(new THREE.Vector3());
  modele.position.sub(new THREE.Vector3(
    (bb.min.x + bb.max.x) / 2,
    bb.min.y,
    (bb.min.z + bb.max.z) / 2,
  ));
  const norme = new THREE.Group();
  norme.add(modele);
  norme.scale.setScalar(1 / taille.y);
  const corps = new THREE.Group(); // reçoit les poses de l'animation
  corps.add(norme);
  const pivot = new THREE.Group();
  pivot.add(corps);
  pivot.visible = false;

  const ratioFace = taille.x / taille.y; // largeur vue de face, en hauteurs
  const ratioProfil = taille.z / taille.y; // largeur vue de profil
  // Un aliment plat et large (croissant) saute en proportion de sa largeur, pas de sa hauteur.
  const amplitude = Math.min(3, Math.max(1, ratioFace, ratioProfil));
  const animation = creerAnimation();
  const poser = (p) => {
    corps.position.y = p.dy * amplitude;
    corps.scale.set(p.sx, p.sy, p.sx);
    corps.rotation.set(p.tangage, 0, p.roulis);
  };
  const attente = () => {
    animation.attente();
    poser(pose('attente', 0));
  };
  return {
    espece, pivot, ratioFace, ratioProfil,
    demarrer: attente,
    arreter: attente,
    mimiques: VARIANTES_HUMEUR,
    mimique: (i) => animation.humeur(i),
    fuir: () => animation.fuite(),
    maj: (dt) => poser(animation.maj(dt)),
  };
}

// Explosion : la créature éclate en morceaux de ses propres triangles (dans la pose du moment),
// projetés avec gravité et rotation, plus un flash et une gerbe de particules selon son ton.
export function creerExplosion(m, textures) {
  const s = m.pivot.scale.x; // hauteur de la créature en points
  const palette = PALETTES[m.espece.ton];
  const groupe = new THREE.Group();

  // Triangles en coordonnées monde, avec leur couleur.
  const sommets = [];
  const couleurs = [];
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  m.pivot.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const col = g.attributes.color;
    const uv = g.attributes.uv;
    const total = g.index ? g.index.count : pos.count;
    const groupes = g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
    const mats = [].concat(o.material);
    for (const gr of groupes) {
      const mat = mats[gr.materialIndex] ?? mats[0];
      const lireTexture = uv ? lecteurTexture(mat.map) : null;
      const fin = Math.min(gr.start + gr.count, total);
      for (let k = gr.start; k < fin; k++) {
        const i = g.index ? g.index.getX(k) : k;
        o.getVertexPosition(i, v).applyMatrix4(o.matrixWorld);
        sommets.push(v.x, v.y, v.z);
        c.copy(mat.color);
        if (mat.vertexColors && col) c.multiply(new THREE.Color(col.getX(i), col.getY(i), col.getZ(i)));
        if (lireTexture) c.multiply(lireTexture(uv.getX(i), uv.getY(i)));
        couleurs.push(c.r, c.g, c.b);
      }
    }
  });

  const centre = new THREE.Vector3();
  for (let k = 0; k < sommets.length; k += 3) centre.add(v.set(sommets[k], sommets[k + 1], sommets[k + 2]));
  centre.divideScalar(Math.max(1, sommets.length / 3));

  // Éclats : groupes de triangles consécutifs (souvent voisins dans le maillage).
  const parEclat = TRIANGLES_PAR_ECLAT * 9;
  const nEclats = Math.ceil(sommets.length / parEclat);
  const centres = new Float32Array(nEclats * 3);
  const vitesses = new Float32Array(nEclats * 3);
  const axes = [];
  const omegas = new Float32Array(nEclats);
  const decalages = new Float32Array(sommets.length);
  for (let e = 0; e < nEclats; e++) {
    const debut = e * parEclat;
    const fin = Math.min(debut + parEclat, sommets.length);
    const ce = new THREE.Vector3();
    for (let k = debut; k < fin; k += 3) ce.add(v.set(sommets[k], sommets[k + 1], sommets[k + 2]));
    ce.divideScalar((fin - debut) / 3);
    for (let k = debut; k < fin; k += 3) {
      decalages[k] = sommets[k] - ce.x;
      decalages[k + 1] = sommets[k + 1] - ce.y;
      decalages[k + 2] = sommets[k + 2] - ce.z;
    }
    const dir = ce.clone().sub(centre);
    if (dir.lengthSq() < 1e-6) dir.randomDirection();
    dir.normalize().multiplyScalar(s * (2 + Math.random() * 3));
    dir.y += s * (1.5 + Math.random());
    centres.set([ce.x, ce.y, ce.z], e * 3);
    vitesses.set([dir.x, dir.y, dir.z], e * 3);
    axes.push(new THREE.Vector3().randomDirection());
    omegas[e] = 5 + Math.random() * 10;
  }
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(sommets);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(couleurs), 3));
  geo.computeVertexNormals();
  const eclats = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: true, side: THREE.DoubleSide,
  }));
  eclats.frustumCulled = false;
  groupe.add(eclats);

  // Flash devant la créature.
  const flash = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({
    color: palette.flash, transparent: true, blending: THREE.AdditiveBlending, depthTest: false,
  }));
  flash.position.set(centre.x, centre.y, centre.z + s * 2);
  groupe.add(flash);

  // Particules : étoiles colorées (kawaii) ou flammes et fumée (méchant).
  const gerbes = [];
  const gerbe = (n, couleursGerbe, tex, taille, vitesse, gravite, additive) => {
    const p = new Float32Array(n * 3);
    const vit = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Vector3().randomDirection();
      p.set([centre.x + d.x * s * 0.2, centre.y + d.y * s * 0.2, centre.z + s], i * 3);
      d.multiplyScalar(s * vitesse * (0.4 + Math.random()));
      vit.set([d.x, d.y + s * vitesse * 0.4, d.z], i * 3);
      c.set(couleursGerbe[i % couleursGerbe.length]);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(g, new THREE.PointsMaterial({
      size: Math.max(8, s * taille), map: tex, vertexColors: true, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    points.frustumCulled = false;
    groupe.add(points);
    gerbes.push({ points, vit, gravite: gravite * s });
  };
  if (m.espece.ton === 'kawaii') {
    gerbe(90, palette.particules, textures.etoile, 0.09, 3, 2.5, false);
  } else {
    gerbe(70, palette.particules, textures.rond, 0.14, 2.5, 1, true);
    gerbe(30, palette.fumee, textures.rond, 0.3, 1, -0.6, false); // la fumée monte
  }

  const gravite = 6 * s;
  const q = new THREE.Quaternion();
  const o = new THREE.Vector3();
  let t = 0;

  function maj(dt) {
    t += dt;
    if (t > DUREE_EXPLOSION) return false;
    const reduction = t > 1 ? Math.max(0, 1 - (t - 1) / 0.7) : 1;
    for (let e = 0; e < nEclats; e++) {
      q.setFromAxisAngle(axes[e], omegas[e] * t);
      const px = centres[e * 3] + vitesses[e * 3] * t;
      const py = centres[e * 3 + 1] + vitesses[e * 3 + 1] * t - 0.5 * gravite * t * t;
      const pz = centres[e * 3 + 2] + vitesses[e * 3 + 2] * t;
      const fin = Math.min((e + 1) * parEclat, positions.length);
      for (let k = e * parEclat; k < fin; k += 3) {
        o.set(decalages[k], decalages[k + 1], decalages[k + 2]).applyQuaternion(q).multiplyScalar(reduction);
        positions[k] = px + o.x;
        positions[k + 1] = py + o.y;
        positions[k + 2] = pz + o.z;
      }
    }
    geo.attributes.position.needsUpdate = true;

    const f = Math.min(1, t / 0.3);
    flash.scale.setScalar(s * (0.3 + 1.2 * f));
    flash.material.opacity = 1 - f;

    for (const { points, vit, gravite: g } of gerbes) {
      const p = points.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        vit[i * 3] *= 1 - 1.5 * dt; // freinage de l'air
        vit[i * 3 + 1] = vit[i * 3 + 1] * (1 - 1.5 * dt) - g * dt;
        p.setXYZ(i, p.getX(i) + vit[i * 3] * dt, p.getY(i) + vit[i * 3 + 1] * dt, p.getZ(i));
      }
      p.needsUpdate = true;
      points.material.opacity = Math.max(0, 1 - t / DUREE_EXPLOSION);
    }
    return true;
  }

  function liberer() {
    groupe.removeFromParent();
    groupe.traverse((x) => {
      x.geometry?.dispose();
      x.material?.dispose();
    });
  }

  return { groupe, maj, liberer };
}

// Couleur d'une texture aux coordonnées (u, v), pour colorer les éclats des créatures texturées
// (modèles texturés). Pixels lus une fois par texture ; null hors navigateur ou sans image.
const pixelsTextures = new WeakMap();
function lecteurTexture(map) {
  const image = map?.image;
  if (!image?.width || typeof document === 'undefined' || !document.createElement) return null;
  let px = pixelsTextures.get(map);
  if (!px) {
    const toile = document.createElement('canvas');
    toile.width = image.width;
    toile.height = image.height;
    const ctx = toile.getContext('2d');
    ctx.drawImage(image, 0, 0);
    px = { data: ctx.getImageData(0, 0, toile.width, toile.height).data, w: toile.width, h: toile.height };
    pixelsTextures.set(map, px);
  }
  const c = new THREE.Color();
  return (u, v) => {
    const x = Math.min(px.w - 1, Math.max(0, Math.floor(u * px.w)));
    const y = Math.min(px.h - 1, Math.max(0, Math.floor((map.flipY ? 1 - v : v) * px.h)));
    const i = (y * px.w + x) * 4;
    return c.setRGB(px.data[i] / 255, px.data[i + 1] / 255, px.data[i + 2] / 255, THREE.SRGBColorSpace);
  };
}

function texture(dessin) {
  const toile = document.createElement('canvas');
  toile.width = toile.height = 64;
  dessin(toile.getContext('2d'), 64);
  const tex = new THREE.CanvasTexture(toile);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function dessinerEtoile(ctx, t) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? t * 0.2 : t * 0.48;
    ctx.lineTo(t / 2 + Math.cos(a) * r, t / 2 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
}

function dessinerRond(ctx, t) {
  const g = ctx.createRadialGradient(t / 2, t / 2, 0, t / 2, t / 2, t / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, t, t);
}
