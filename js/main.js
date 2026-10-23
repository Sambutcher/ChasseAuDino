// Boucle du jeu : une partie alterne course (GPS, caméra éteinte) et tir, un lancer de tomate
// (caméra, détection des animaux et des voitures par YOLO, créature 3D suivie par flux optique).
// La logique pure vit dans game.js, especes.js, course.js, tracker.js, flow.js et geometry.js ; ce
// fichier relie le navigateur (caméra, GPS, canvas, three.js, sons) à cette logique.
import { demarrerCamera, arreterCamera, relancerAuRetour } from './camera.js';
import { suivrePosition, garderEcranAllume } from './position.js';
import { creerCourse } from './course.js';
import { chargerDetecteur, detecter } from './detector.js';
import { chargerPose, estimerPose } from './pose.js';
import { chargerCap, estimerCap } from './cap-modele.js';
import { GRIS, capStable, decoupeCarree, lacetAliment, lisserProbas, rectanglesDecoupe } from './cap.js';
import { classePose, combiner, estimationStable, inclinaisonTete, lacetDe, orientation, teteBaissee, zonePose } from './posture.js';
import { creerRendu } from './render.js';
import { creerCreatures } from './creatures.js';
import { creerSons } from './sons.js';
import { ESPECES, especeDe, estVoiture, filtrerEspece, messageIssue } from './especes.js';
import { creerSuivi } from './tracker.js';
import { versGris, estimerDecalage } from './flow.js';
import { nouvelEtat, debloquerTir, finSerie, voirCreature, quitterCreature, tirer } from './game.js';
import { cadrage, letterbox, versEcran, plusProcheDe, zoneDetection, placementVideo } from './geometry.js';

const URL_MODELE = 'models/yolo11n/model.json';
const URL_POSE = 'models/pose/model.json';
const URL_CAP = 'models/cap/model.json';
// Entre deux estimations de posture de l'animal suivi : chaque inférence bloque un instant le fil
// principal, donc rares ; plus espacées encore quand la posture est stable.
const INTERVALLE_CAP_MS = 800; // cap des voitures
const INTERVALLE_CAP_STABLE_MS = 2000; // quand les derniers secteurs concordent
const INTERVALLE_POSE_MS = 500;
const INTERVALLE_POSE_STABLE_MS = 1200;
const ESTIMATIONS_POSE = 3; // dernières estimations moyennées
const ZOOM = 1.5; // zoom numérique de l'image affichée
const INTERVALLE_DETECTION_MS = 80;
const LARGEUR_FLUX = 120; // largeur de l'image réduite pour le flux optique
const RAYON_FLUX = 12; // déplacement max mesuré par trame, en pixels de l'image réduite
const DISTANCE_COURSE = 100; // mètres à vol d'oiseau pour débloquer le tir
const DELAI_FIN_SERIE_MS = 2200; // temps de l'explosion ou de la fuite après l'impact
const DUREE_FLASH_MS = 250;

const accueil = document.getElementById('accueil');
const boutonDemarrer = document.getElementById('demarrer');
const statut = document.getElementById('statut');
const video = document.getElementById('video');
const canvasVideo = document.getElementById('jeu');
const canvasCreatures = document.getElementById('creatures');
const canvas = document.getElementById('hud');
const pasDeTir = document.getElementById('pas-de-tir');
const boutonTir = document.getElementById('position-tir');
const boutonSkip = document.getElementById('skip');
const erreurCamera = document.getElementById('erreur-camera');

// Pas de service worker sur le serveur de dev (adresse IP ou localhost) : avec le certificat
// auto-signé, ses requêtes réseau échouent (« Load failed ») et il bloquerait toutes les pages
// de l'adresse, y compris celles d'un autre projet servi au même endroit.
const DEV = /^(\d+\.){3}\d+$|^localhost$/.test(location.hostname);
if ('serviceWorker' in navigator) {
  if (DEV) {
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  } else {
    // Mise à jour : sw.js jamais pris dans le cache HTTP (GitHub Pages le garde 10 min), vérifié à
    // chaque ouverture ; quand une nouvelle version prend la main, la page se recharge pour
    // l'afficher (sinon l'ancienne restait jusqu'au rechargement suivant).
    const dejaControlee = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (dejaControlee) location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then((r) => r.update())
      .catch((e) => console.warn('Service worker :', e));
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
    statut.textContent = 'Chargement de la posture…';
    // Sans le modèle de pose, les créatures regardent simplement vers le centre de l'écran.
    const pose = await chargerPose(URL_POSE).catch((e) => { console.warn('Posture indisponible :', e); return null; });
    statut.textContent = 'Chargement du cap des voitures…';
    // Sans le modèle de cap, les aliments regardent simplement vers le centre de l'écran.
    const cap = await chargerCap(URL_CAP).catch((e) => { console.warn('Cap indisponible :', e); return null; });
    statut.textContent = 'Réveil des créatures…';
    const creatures = await creerCreatures(canvasCreatures);
    accueil.hidden = true;
    lancerPartie(entree, creatures, pose, cap);
  } catch (e) {
    console.error(e);
    statut.textContent = `Impossible de démarrer : ${e.message || e}`;
    boutonDemarrer.disabled = false;
  }
});

function lancerPartie(entree, creatures, pose, cap) {
  const rendu = creerRendu(canvasVideo, canvas);
  let etat = nouvelEtat();

  // --- Course : GPS actif toute la partie ; le tir se débloque à DISTANCE_COURSE du départ. ---
  const course = creerCourse({ distance: DISTANCE_COURSE });
  let alerteGps = null;
  suivrePosition(
    (fix) => { alerteGps = null; course.ajouter(fix); },
    (message) => { alerteGps = message; },
  );
  course.demarrer(Date.now());
  pasDeTir.hidden = false;

  // --- Tir : caméra, suivi de la cible, détection. ---
  let suivi = creerSuivi();
  let cible = null; // boîte écran de la cible quand elle est visible
  let allumageCamera = false;
  let finSerieA = null; // instant de l'impact
  relancerAuRetour(video);

  // Mémoire graphique saturée : iOS retire un contexte WebGL (détection arrêtée, image réduite).
  // Rien à sauver : on prévient puis on recharge le jeu.
  let contextePerdu = false;
  const surContextePerdu = () => {
    if (contextePerdu) return;
    contextePerdu = true;
    console.warn('Contexte WebGL perdu : rechargement');
    setTimeout(() => location.reload(), 1500);
  };
  canvasCreatures.addEventListener('webglcontextlost', surContextePerdu);
  try {
    tf.backend().gpgpu.gl.canvas.addEventListener('webglcontextlost', surContextePerdu);
  } catch (e) {
    console.warn('Contexte de TensorFlow non surveillé :', e);
  }
  let dernierTir = { resultat: null, t: -Infinity };

  const canvasEntree = document.createElement('canvas'); // entrée du modèle
  canvasEntree.width = entree.largeur;
  canvasEntree.height = entree.hauteur;
  const ctxEntree = canvasEntree.getContext('2d', { willReadFrequently: true });
  let detectionEnCours = false; // une seule inférence à la fois (détection ou posture)
  let derniereDetection = 0;
  const canvasPose = document.createElement('canvas'); // carré autour de l'animal suivi
  if (pose) {
    canvasPose.width = pose.largeur;
    canvasPose.height = pose.hauteur;
  }
  const ctxPose = canvasPose.getContext('2d', { willReadFrequently: true });
  let dernierePose = 0;
  let historiquePose = []; // dernières orientations estimées de l'animal suivi
  let lacetPose = null; // angle de la créature d'après la posture, null tant qu'inconnu
  let inclinaisons = []; // dernières inclinaisons de la tête de l'animal suivi
  let teteBasse = false; // l'animal a la tête baissée : la créature broute
  const canvasCap = document.createElement('canvas'); // découpe carrée autour de la voiture suivie
  if (cap) {
    canvasCap.width = cap.largeur;
    canvasCap.height = cap.hauteur;
  }
  const ctxCap = canvasCap.getContext('2d', { willReadFrequently: true });
  let dernierCap = 0;
  let probasCap = null; // probabilités lissées des 8 secteurs de la voiture suivie
  let secteursCap = []; // derniers secteurs dominants
  let cycleDetection = 0;

  const canvasFlux = document.createElement('canvas'); // image réduite en gris pour le flux optique
  const ctxFlux = canvasFlux.getContext('2d', { willReadFrequently: true });
  let grisPrec = null;

  // « Lancer de tomate » (après 100 m) ou « Skip » (sans courir) : rallume la caméra (geste
  // utilisateur, exigé par iOS) et donne une tomate.
  async function allerAuTir() {
    if (allumageCamera) return;
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
    etat = debloquerTir(etat);
    pasDeTir.hidden = true;
  }
  boutonTir.addEventListener('click', () => {
    if (course.etat().phase === 'fini') allerAuTir();
  });
  boutonSkip.addEventListener('click', allerAuTir);

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

  // Tap = l'unique lancer : la tomate part en cloche vers le viseur (centre de l'écran). À
  // l'impact, la créature qui s'y trouve explose ; sinon elle s'enfuit. Si l'animal a disparu
  // pendant le vol, la tomate est perdue sans compter : la main en reprend une.
  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    sons.debloquer(); // iOS peut suspendre l'audio à l'allumage de la caméra
    if (!cible || !etat.cibleVisible || etat.issue || etat.cartouches === 0) return;
    const viseur = { x: rendu.largeur / 2, y: rendu.hauteur / 2 };
    if (creatures.lancerTomate(viseur, () => impact(viseur))) sons.lancer();
  });

  function impact(viseur) {
    const r = tirer(etat, creatures.touche(viseur));
    if (!r.resultat) return false;
    etat = r.etat;
    const { ton } = ESPECES[etat.espece];
    sons.splat();
    if (r.resultat === 'touche') {
      creatures.exploser();
      sons.explosion(ton);
    } else {
      creatures.fuir();
      sons.fuite(ton);
    }
    dernierTir = { resultat: r.resultat, t: performance.now() };
    finSerieA = performance.now();
    return r.resultat === 'touche';
  }

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

  // Posture de l'animal suivi : carré découpé autour de lui, estimé par yolo11n-pose ; l'orientation
  // (profil, sens, dos) des dernières estimations donne l'angle de la créature.
  function lancerPose(c, t) {
    detectionEnCours = true;
    dernierePose = t;
    const suiviLancement = suivi;
    const zone = zonePose(cible, rendu.largeur, rendu.hauteur);
    dessinerVideo(ctxPose, c, zone, { x: 0, y: 0, w: canvasPose.width, h: canvasPose.height });
    estimerPose(canvasPose, classePose(cible.classe))
      .then((detection) => {
        if (suivi !== suiviLancement) return; // série terminée entre-temps
        const vue = detection ? orientation(detection) : null;
        historiquePose = [...historiquePose, vue].slice(-ESTIMATIONS_POSE);
        inclinaisons = [...inclinaisons, vue ? inclinaisonTete(detection, vue) : null].slice(-ESTIMATIONS_POSE);
        teteBasse = teteBaissee(inclinaisons, teteBasse);
        const o = combiner(historiquePose);
        lacetPose = o ? lacetDe(o) : null;
      })
      .catch((e) => console.error(e))
      .finally(() => { detectionEnCours = false; });
  }

  // Cap de la voiture suivie : découpe carrée (grise hors écran) estimée par le modèle d'orientation;
  // les probabilités lissées donnent l'angle de l'aliment.
  function lancerCap(c, t) {
    detectionEnCours = true;
    dernierCap = t;
    const suiviLancement = suivi;
    const r = rectanglesDecoupe(decoupeCarree(cible), rendu.largeur, rendu.hauteur, canvasCap.width);
    if (!r) { detectionEnCours = false; return; }
    ctxCap.fillStyle = GRIS;
    ctxCap.fillRect(0, 0, canvasCap.width, canvasCap.height);
    dessinerVideo(ctxCap, c, r.source, r.dest);
    estimerCap(canvasCap)
      .then((probas) => {
        if (suivi !== suiviLancement) return; // série terminée entre-temps
        probasCap = lisserProbas(probasCap, probas);
        secteursCap = [...secteursCap, probasCap.indexOf(Math.max(...probasCap))].slice(-3);
        lacetPose = lacetAliment(probasCap);
      })
      .catch((e) => console.error(e))
      .finally(() => { detectionEnCours = false; });
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
    const lu = suivi.lire(t);
    cible = lu.actif ? lu.cible : null;
    // Aucune inférence pendant le lancer, l'explosion ou la fuite : tout le GPU va à l'animation ; le
    // flux optique garde la cible pendant le lancer.
    const animation = etat.issue || creatures.lancerEnCours;
    if (creatures.lancerEnCours) suivi.prolonger(t);
    if (!detectionEnCours && !animation && t - derniereDetection >= INTERVALLE_DETECTION_MS) {
      const posturable = pose && cible && !estVoiture(cible.classe) 
        && classePose(cible.classe) >= 0;
      const delaiPose = estimationStable(historiquePose, ESTIMATIONS_POSE) ? INTERVALLE_POSE_STABLE_MS : INTERVALLE_POSE_MS;
      const orientable = cap && cible && estVoiture(cible.classe);
      if (posturable && t - dernierePose >= delaiPose) lancerPose(c, t);
      else if (orientable && t - dernierCap >= (capStable(secteursCap) ? INTERVALLE_CAP_STABLE_MS : INTERVALLE_CAP_MS)) lancerCap(c, t);
      else lancerDetection(c, t);
    }

    if (cible && !etat.cibleVisible) {
      etat = voirCreature(etat, etat.issue ? etat.espece : especeDe(cible.classe));
    } else if (!cible && etat.cibleVisible) {
      etat = quitterCreature(etat);
    }
    if (!cible) {
      historiquePose = [];
      inclinaisons = [];
      teteBasse = false;
      probasCap = null;
      secteursCap = [];
      lacetPose = null;
    }
    const visible = cible && etat.cibleVisible;

    rendu.effacer();
    rendu.video(video, c);
    if (!etat.issue) {
      if (visible) creatures.montrer(etat.espece, cible, t, lacetPose, teteBasse);
      else creatures.cacher();
    }
    creatures.dessiner(t);
    creatures.preparerTomate(etat.cartouches > 0);
    if (visible && !etat.issue) {
      rendu.viseur(t, creatures.cheminTomate({ x: rendu.largeur / 2, y: rendu.hauteur / 2 }));
    }
    if (etat.issue) rendu.message(messageIssue(ESPECES[etat.espece], etat.issue));

    const age = t - dernierTir.t;
    if (age < DUREE_FLASH_MS) rendu.flash(dernierTir.resultat, 1 - age / DUREE_FLASH_MS);
  }

  function image(t) {
    if (contextePerdu) {
      rendu.effacer();
      rendu.message('Mémoire saturée, redémarrage…');
      requestAnimationFrame(image);
      return;
    }
    if (finSerieA !== null && t - finSerieA > DELAI_FIN_SERIE_MS) passerEnCourse();
    if (etat.phase === 'course') {
      rendu.effacer();
      imageCourse();
    } else imageTir(t);
    requestAnimationFrame(image);
  }
  requestAnimationFrame(image);
}
