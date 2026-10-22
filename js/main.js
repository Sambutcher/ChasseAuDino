// Boucle du jeu : une partie alterne course (GPS, caméra éteinte) et tir (caméra, détection des
// animaux et des voitures par YOLO, créature 3D suivie par flux optique). La logique pure vit
// dans game.js, especes.js, couleur.js, course.js, tracker.js, flow.js et geometry.js ; ce
// fichier relie le navigateur (caméra, GPS, canvas, three.js, sons) à cette logique.
import { demarrerCamera, arreterCamera } from './camera.js';
import { suivrePosition, garderEcranAllume } from './position.js';
import { creerCourse } from './course.js';
import { chargerDetecteur, detecter } from './detector.js';
import { creerRendu } from './render.js';
import { creerCreatures } from './creatures.js';
import { creerSons } from './sons.js';
import { ESPECES, especeDe, estVoiture, filtrerEspece, messageIssue } from './especes.js';
import { couleurVoiture, majorite, zoneCarrosserie } from './couleur.js';
import { creerSuivi } from './tracker.js';
import { versGris, estimerDecalage } from './flow.js';
import { nouvelEtat, debloquerTir, finSerie, serieTerminee, voirCreature, quitterCreature, tirer } from './game.js';
import { cadrage, letterbox, versEcran, plusProcheDe, zoneDetection, placementVideo } from './geometry.js';

const URL_MODELE = 'models/yolo11n/model.json';
const VOTES_COULEUR = 5; // images analysées avant de choisir le personnage d'une voiture
const ZOOM = 1.5; // zoom numérique de l'image affichée
const INTERVALLE_DETECTION_MS = 80;
const LARGEUR_FLUX = 120; // largeur de l'image réduite pour le flux optique
const RAYON_FLUX = 12; // déplacement max mesuré par trame, en pixels de l'image réduite
const DISTANCE_COURSE = 100; // mètres à vol d'oiseau pour débloquer le tir
const DELAI_FIN_SERIE_MS = 2200; // temps de l'explosion ou de la fuite après le tir
const DUREE_FLASH_MS = 250;
const SIMGPS = new URLSearchParams(location.search).has('simgps'); // course simulée, pour tester sans courir

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

  // --- Tir : caméra, suivi de la cible, détection. ---
  let suivi = creerSuivi();
  let cible = null; // boîte écran de la cible quand elle est visible
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

  const canvasFlux = document.createElement('canvas'); // image réduite en gris pour le flux optique
  const ctxFlux = canvasFlux.getContext('2d', { willReadFrequently: true });
  let grisPrec = null;

  const canvasCouleur = document.createElement('canvas'); // carrosserie réduite d'une voiture
  canvasCouleur.width = 32;
  canvasCouleur.height = 12;
  const ctxCouleur = canvasCouleur.getContext('2d', { willReadFrequently: true });
  let votesCouleur = [];

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
    votesCouleur = [];
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
    if (!cible || !etat.cibleVisible) return;
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

  // Dessine la zone `zone` de l'écran (vue de la caméra) dans le rectangle `cible` d'un canvas :
  // vidéo entière placée par placementVideo, jamais découpée (bug du quart d'image sur iOS).
  function dessinerVideo(ctx, c, zone, cibleCanvas) {
    const p = placementVideo(c, video.videoWidth, video.videoHeight, rendu.largeur, rendu.hauteur, zone, cibleCanvas);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cibleCanvas.x, cibleCanvas.y, cibleCanvas.w, cibleCanvas.h);
    ctx.clip();
    ctx.drawImage(video, p.x, p.y, p.w, p.h);
    ctx.restore();
  }

  // Flux optique : déplacement de l'image depuis la trame précédente, appliqué à la cible.
  function suivreImage(c) {
    const k = LARGEUR_FLUX / rendu.largeur; // écran → image réduite
    const l = LARGEUR_FLUX;
    const h = Math.round(rendu.hauteur * k);
    if (canvasFlux.width !== l || canvasFlux.height !== h) {
      canvasFlux.width = l;
      canvasFlux.height = h;
      grisPrec = null;
    }
    dessinerVideo(ctxFlux, c, { x: 0, y: 0, w: rendu.largeur, h: rendu.hauteur }, { x: 0, y: 0, w: l, h });
    const gris = versGris(ctxFlux.getImageData(0, 0, l, h).data);
    if (grisPrec) {
      const b = suivi.lire(performance.now()).cible;
      // Autour de la cible (boîte agrandie ×2), sinon bloc central.
      const zone = b
        ? { x: (b.x - b.w / 2) * k, y: (b.y - b.h / 2) * k, w: b.w * 2 * k, h: b.h * 2 * k }
        : { x: l / 4, y: h / 4, w: l / 2, h: h / 2 };
      const d = estimerDecalage(grisPrec, gris, l, h, zone, RAYON_FLUX);
      if (d.fiable && (d.dx || d.dy)) suivi.deplacer(d.dx / k, d.dy / k);
    }
    grisPrec = gris;
  }

  // Une seule inférence à la fois, sur une zone d'intérêt de l'écran (autour de la cible suivie, ou
  // alternativement vue entière / centre) : les cibles lointaines y gardent assez de pixels.
  // La boîte détectée décrit l'image du lancement : on la décale du mouvement survenu depuis.
  function lancerDetection(c, t) {
    detectionEnCours = true;
    derniereDetection = t;
    const suiviLancement = suivi;
    const cumulDepart = suivi.cumul;
    const zone = zoneDetection(suivi.lire(t).cible, rendu.largeur, rendu.hauteur,
      canvasEntree.width / canvasEntree.height, cycleDetection++);
    const lb = letterbox(zone.w, zone.h, canvasEntree.width, canvasEntree.height);
    ctxEntree.fillStyle = 'rgb(114,114,114)';
    ctxEntree.fillRect(0, 0, canvasEntree.width, canvasEntree.height);
    dessinerVideo(ctxEntree, c, zone, { x: lb.dx, y: lb.dy, w: lb.dw, h: lb.dh });
    detecter(canvasEntree)
      .then((boites) => {
        if (suivi !== suiviLancement) return; // série terminée entre-temps
        const fin = performance.now();
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
        const classe = etat.espece === null ? null : ESPECES[etat.espece].classe;
        suivi.maj(plusProcheDe(filtrerEspece(ecran, classe), centre), fin);
      })
      .catch((e) => console.error(e))
      .finally(() => { detectionEnCours = false; });
  }

  // Espèce d'une cible qui apparaît : directe pour un animal ; pour une voiture, d'après la
  // couleur de sa carrosserie votée sur plusieurs images (null tant que le vote n'est pas fini).
  function especeCible(c, boite) {
    if (!estVoiture(boite.classe)) return especeDe(boite.classe);
    ctxCouleur.fillStyle = 'rgb(114,114,114)';
    ctxCouleur.fillRect(0, 0, canvasCouleur.width, canvasCouleur.height);
    dessinerVideo(ctxCouleur, c, zoneCarrosserie(boite), { x: 0, y: 0, w: canvasCouleur.width, h: canvasCouleur.height });
    votesCouleur.push(couleurVoiture(ctxCouleur.getImageData(0, 0, canvasCouleur.width, canvasCouleur.height).data));
    return votesCouleur.length < VOTES_COULEUR ? null : especeDe(boite.classe, majorite(votesCouleur));
  }

  function imageCourse() {
    const e = course.etat();
    boutonTir.disabled = e.phase !== 'fini' || allumageCamera;
    rendu.course(e, alerteGps);
  }

  function imageTir(t) {
    if (!video.videoWidth) return; // caméra pas encore prête
    const c = cadrage(video.videoWidth, video.videoHeight, rendu.largeur, rendu.hauteur, ZOOM);
    suivreImage(c);
    if (!detectionEnCours && t - derniereDetection >= INTERVALLE_DETECTION_MS) lancerDetection(c, t);

    const lu = suivi.lire(t);
    cible = lu.actif ? lu.cible : null;
    if (cible && !etat.cibleVisible) {
      const cle = etat.issue ? etat.espece : especeCible(c, cible);
      if (cle) etat = voirCreature(etat, cle);
    } else if (!cible && etat.cibleVisible) {
      etat = quitterCreature(etat);
    }
    if (!cible) votesCouleur = [];
    const visible = cible && etat.cibleVisible;

    rendu.effacer();
    rendu.video(video, c);
    if (!etat.issue) {
      if (visible) creatures.montrer(etat.espece, cible, t);
      else creatures.cacher();
    }
    creatures.dessiner(t);
    if (visible && !etat.issue) rendu.viseur();
    if (visible || serieTerminee(etat)) rendu.cartouches(etat.cartouches);
    if (etat.issue) rendu.message(messageIssue(ESPECES[etat.espece], etat.issue));
    else if (!visible) rendu.message('Cherchez un animal ou une voiture…');

    const age = t - dernierTir.t;
    if (age < DUREE_FLASH_MS) rendu.flash(dernierTir.resultat, 1 - age / DUREE_FLASH_MS);
  }

  function image(t) {
    if (finSerieA !== null && t - finSerieA > DELAI_FIN_SERIE_MS) passerEnCourse();
    if (etat.phase === 'course') {
      rendu.effacer();
      imageCourse();
    } else imageTir(t);
    requestAnimationFrame(image);
  }
  requestAnimationFrame(image);
}
