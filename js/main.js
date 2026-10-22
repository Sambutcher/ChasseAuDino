// Boucle du jeu : une partie alterne course (GPS, caméra éteinte) et tir (caméra, détection des
// animaux, créature 3D suivie par flux optique). La logique pure vit dans game.js, especes.js,
// course.js, tracker.js, flow.js et geometry.js ; ce fichier relie le navigateur (caméra, GPS,
// canvas, three.js, sons) à cette logique.
import { demarrerCamera, arreterCamera } from './camera.js';
import { suivrePosition, garderEcranAllume } from './position.js';
import { creerCourse } from './course.js';
import { chargerDetecteur, detecter } from './detector.js';
import { creerRendu } from './render.js';
import { creerCreatures } from './creatures.js';
import { creerSons } from './sons.js';
import { ESPECES, filtrerEspece, messageIssue } from './especes.js';
import { creerSuivi } from './tracker.js';
import { versGris, estimerDecalage } from './flow.js';
import { nouvelEtat, debloquerTir, finSerie, serieTerminee, voirCreature, quitterCreature, tirer } from './game.js';
import { cadrage, letterbox, versEcran, plusProcheDe, zoneDetection, zoneVersSource } from './geometry.js';

const URL_MODELE = 'models/yolo11n/model.json';
const ZOOM = 1.5; // zoom numérique de l'image affichée
const INTERVALLE_DETECTION_MS = 80;
const LARGEUR_FLUX = 120; // largeur de l'image réduite pour le flux optique
const RAYON_FLUX = 12; // déplacement max mesuré par trame, en pixels de l'image réduite
const DISTANCE_COURSE = 100; // mètres à vol d'oiseau pour débloquer le tir
const DELAI_FIN_SERIE_MS = 2200; // temps de l'explosion ou de la fuite après le tir
const DUREE_FLASH_MS = 250;
const PARAMS = new URLSearchParams(location.search);
const DEBUG = PARAMS.has('debug'); // diagnostic à l'écran
const SIMGPS = PARAMS.has('simgps'); // course simulée, pour tester sans courir

const accueil = document.getElementById('accueil');
const boutonDemarrer = document.getElementById('demarrer');
const statut = document.getElementById('statut');
const video = document.getElementById('video');
const canvasVideo = document.getElementById('jeu');
const canvasCreatures = document.getElementById('creatures');
const canvas = document.getElementById('hud');
const pasDeTir = document.getElementById('pas-de-tir');
const boutonTir = document.getElementById('position-tir');
const erreurCamera = document.getElementById('erreur-camera');
const boutonPasserCourse = document.getElementById('passer-course');

// Pas de service worker sur le serveur de dev (adresse IP ou localhost) : avec le certificat
// auto-signé, ses requêtes réseau échouent (« Load failed ») et il bloquerait toutes les pages
// de l'adresse, y compris celles d'un autre projet servi au même endroit.
const DEV = /^(\d+\.){3}\d+$|^localhost$/.test(location.hostname);
if ('serviceWorker' in navigator) {
  if (DEV) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  } else {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker :', e));
  }
}

const sons = creerSons();

boutonDemarrer.addEventListener('click', async () => {
  boutonDemarrer.disabled = true;
  sons.debloquer(); // dans le geste utilisateur, exigé par iOS
  try {
    garderEcranAllume();
    statut.textContent = 'Chargement du détecteur…';
    const entree = await chargerDetecteur(URL_MODELE);
    statut.textContent = 'Réveil des créatures…';
    const creatures = await creerCreatures(canvasCreatures, { quandHumeur: (e) => sons.humeur(e.ton) });
    accueil.hidden = true;
    lancerPartie(entree, creatures);
  } catch (e) {
    console.error(e);
    statut.textContent = `Impossible de démarrer : ${e.message || e}`;
    boutonDemarrer.disabled = false;
  }
});

function lancerPartie(entree, creatures) {
  const rendu = creerRendu(canvasVideo, canvas);
  let etat = nouvelEtat();

  // --- Course : GPS actif toute la partie ; le tir se débloque à DISTANCE_COURSE du départ. ---
  const course = creerCourse({ distance: DISTANCE_COURSE });
  let alerteGps = null;
  suivrePosition(
    (fix) => { alerteGps = null; course.ajouter(fix); },
    (message) => { alerteGps = message; },
    { simulation: SIMGPS },
  );
  course.demarrer(Date.now());
  pasDeTir.hidden = false;

  // Debug : course faite d'un coup (départ reculé au-delà de DISTANCE_COURSE).
  boutonPasserCourse.hidden = !DEBUG;
  boutonPasserCourse.addEventListener('click', () => course.reculerDepart(DISTANCE_COURSE + 10));

  // --- Tir : caméra, suivi de la cible, détection. ---
  let suivi = creerSuivi();
  let cible = null; // boîte écran de l'animal quand il est visible
  let allumageCamera = false;
  let finSerieA = null; // instant du tir
  let dernierTir = { resultat: null, t: -Infinity };

  const canvasEntree = document.createElement('canvas'); // entrée du modèle
  canvasEntree.width = entree.largeur;
  canvasEntree.height = entree.hauteur;
  const ctxEntree = canvasEntree.getContext('2d', { willReadFrequently: true });
  let detectionEnCours = false;
  let derniereDetection = 0;
  let cycleDetection = 0;
  let zoneAnalysee = null;

  const canvasFlux = document.createElement('canvas'); // image réduite en gris pour le flux optique
  const ctxFlux = canvasFlux.getContext('2d', { willReadFrequently: true });
  let grisPrec = null;

  const stats = { images: 0, detections: 0, inferenceMs: 0, fluxMs: 0, flux: { fiable: false }, debut: 0, texte: [] };

  // « Position de tir » : rallume la caméra (geste utilisateur, exigé par iOS) et charge la carabine.
  boutonTir.addEventListener('click', async () => {
    if (course.etat().phase !== 'fini' || allumageCamera) return;
    allumageCamera = true;
    boutonTir.disabled = true;
    erreurCamera.textContent = '';
    try {
      await demarrerCamera(video);
    } catch (e) {
      console.error(e);
      erreurCamera.textContent = `Caméra indisponible : ${e.message || e}`;
      return;
    } finally {
      allumageCamera = false;
    }
    suivi = creerSuivi();
    grisPrec = null;
    cible = null;
    zoneAnalysee = null;
    etat = debloquerTir(etat);
    pasDeTir.hidden = true;
  });

  // Série terminée : caméra coupée, nouvelle course depuis la position actuelle.
  function passerEnCourse() {
    arreterCamera(video);
    creatures.cacher();
    etat = finSerie(etat);
    cible = null;
    finSerieA = null;
    course.demarrer(Date.now());
    erreurCamera.textContent = '';
    pasDeTir.hidden = false;
  }

  // Tap = l'unique tir, au centre de l'écran (croix de visée) : la créature explose ou s'enfuit.
  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    sons.debloquer(); // iOS peut suspendre l'audio à l'allumage de la caméra
    if (!cible) return;
    const viseur = { x: rendu.largeur / 2, y: rendu.hauteur / 2 };
    const r = tirer(etat, creatures.touche(viseur));
    if (!r.resultat) return;
    etat = r.etat;
    const { ton } = ESPECES[etat.espece];
    sons.tir();
    if (r.resultat === 'touche') {
      creatures.exploser();
      sons.explosion(ton);
    } else {
      creatures.fuir();
      sons.fuite(ton);
    }
    dernierTir = { resultat: r.resultat, t: performance.now() };
    finSerieA = performance.now();
  });

  // Flux optique : déplacement de l'image depuis la trame précédente, appliqué à la cible.
  function suivreImage(c) {
    const t0 = performance.now();
    const k = LARGEUR_FLUX / rendu.largeur; // écran → image réduite
    const l = LARGEUR_FLUX;
    const h = Math.round(rendu.hauteur * k);
    if (canvasFlux.width !== l || canvasFlux.height !== h) {
      canvasFlux.width = l;
      canvasFlux.height = h;
      grisPrec = null;
    }
    ctxFlux.drawImage(video, c.sx, c.sy, c.sw, c.sh, 0, 0, l, h);
    const gris = versGris(ctxFlux.getImageData(0, 0, l, h).data);
    if (grisPrec) {
      const b = suivi.lire(t0).cible;
      // Autour de la cible (boîte agrandie ×2), sinon bloc central.
      const zone = b
        ? { x: (b.x - b.w / 2) * k, y: (b.y - b.h / 2) * k, w: b.w * 2 * k, h: b.h * 2 * k }
        : { x: l / 4, y: h / 4, w: l / 2, h: h / 2 };
      const d = estimerDecalage(grisPrec, gris, l, h, zone, RAYON_FLUX);
      if (d.fiable && (d.dx || d.dy)) suivi.deplacer(d.dx / k, d.dy / k);
      stats.flux = d;
    }
    grisPrec = gris;
    stats.fluxMs = performance.now() - t0;
  }

  // Une seule inférence à la fois, sur une zone d'intérêt de l'écran (autour de l'animal suivi, ou
  // alternativement vue entière / centre) : les animaux lointains y gardent assez de pixels.
  // La boîte détectée décrit l'image du lancement : on la décale du mouvement survenu depuis.
  function lancerDetection(c, t) {
    detectionEnCours = true;
    derniereDetection = t;
    const suiviLancement = suivi;
    const cumulDepart = suivi.cumul;
    const zone = zoneDetection(suivi.lire(t).cible, rendu.largeur, rendu.hauteur,
      canvasEntree.width / canvasEntree.height, cycleDetection++);
    zoneAnalysee = zone;
    const src = zoneVersSource(zone, c, rendu.largeur, rendu.hauteur);
    const lb = letterbox(src.sw, src.sh, canvasEntree.width, canvasEntree.height);
    ctxEntree.fillStyle = 'rgb(114,114,114)';
    ctxEntree.fillRect(0, 0, canvasEntree.width, canvasEntree.height);
    ctxEntree.drawImage(video, src.sx, src.sy, src.sw, src.sh, lb.dx, lb.dy, lb.dw, lb.dh);
    detecter(canvasEntree)
      .then((boites) => {
        if (suivi !== suiviLancement) return; // série terminée entre-temps
        const fin = performance.now();
        stats.inferenceMs = fin - t;
        stats.detections++;
        const cumul = suivi.cumul;
        const ecran = boites.map((b) => {
          const e = versEcran(b, lb, zone.w, zone.h);
          return {
            ...e, x: e.x + zone.x + cumul.x - cumulDepart.x, y: e.y + zone.y + cumul.y - cumulDepart.y, classe: b.classe,
          };
        });
        const reference = suivi.lire(fin).cible;
        const centre = reference
          ? { x: reference.x + reference.w / 2, y: reference.y + reference.h / 2 }
          : { x: rendu.largeur / 2, y: rendu.hauteur / 2 };
        suivi.maj(plusProcheDe(filtrerEspece(ecran, etat.espece), centre), fin);
      })
      .catch((e) => console.error(e))
      .finally(() => { detectionEnCours = false; });
  }

  function imageCourse() {
    const e = course.etat();
    boutonTir.disabled = e.phase !== 'fini' || allumageCamera;
    rendu.course(e, alerteGps);
    if (DEBUG) {
      rendu.diagnostic([
        `phase ${e.phase}`,
        `GPS ±${e.precision === null ? '—' : Math.round(e.precision)} m`,
        SIMGPS ? 'simulation' : 'GPS réel',
      ]);
    }
  }

  function imageTir(t) {
    if (!video.videoWidth) return; // caméra pas encore prête
    const c = cadrage(video.videoWidth, video.videoHeight, rendu.largeur, rendu.hauteur, ZOOM);
    suivreImage(c);
    if (!detectionEnCours && t - derniereDetection >= INTERVALLE_DETECTION_MS) lancerDetection(c, t);

    const lu = suivi.lire(t);
    if (lu.actif) etat = voirCreature(etat, lu.cible.classe);
    else if (etat.cibleVisible) etat = quitterCreature(etat);
    cible = lu.actif ? lu.cible : null;

    rendu.effacer();
    rendu.video(video, c);
    if (!etat.issue) {
      if (cible) creatures.montrer(etat.espece, cible, t);
      else creatures.cacher();
    }
    creatures.dessiner(t);
    if (cible && !etat.issue) rendu.viseur();
    if (cible || serieTerminee(etat)) rendu.cartouches(etat.cartouches);
    if (etat.issue) rendu.message(messageIssue(ESPECES[etat.espece], etat.issue));
    else if (!cible) rendu.message('Cherchez un animal…');

    const age = t - dernierTir.t;
    if (age < DUREE_FLASH_MS) rendu.flash(dernierTir.resultat, 1 - age / DUREE_FLASH_MS);
    if (DEBUG) diagnosticTir(t);
  }

  function diagnosticTir(t) {
    stats.images++;
    if (t - stats.debut >= 1000) {
      const s = (t - stats.debut) / 1000;
      stats.texte = [
        `${(stats.images / s).toFixed(0)} img/s`,
        `${(stats.detections / s).toFixed(1)} détections/s`,
        `inférence ${stats.inferenceMs.toFixed(0)} ms`,
        `flux ${stats.fluxMs.toFixed(1)} ms`,
      ];
      stats.images = 0;
      stats.detections = 0;
      stats.debut = t;
    }
    const f = stats.flux;
    if (zoneAnalysee) rendu.zone(zoneAnalysee);
    rendu.diagnostic([
      ...stats.texte,
      `décalage ${f.fiable ? `${f.dx},${f.dy}` : '—'}`,
      `zone ${zoneAnalysee ? zoneAnalysee.type : '—'}`,
      `espèce ${etat.espece === null ? '—' : ESPECES[etat.espece].nom}`,
    ]);
  }

  function image(t) {
    if (finSerieA !== null && t - finSerieA > DELAI_FIN_SERIE_MS) passerEnCourse();
    if (etat.phase === 'course') {
      rendu.effacer();
      imageCourse();
    }
    else imageTir(t);
    requestAnimationFrame(image);
  }
  requestAnimationFrame(image);
}
