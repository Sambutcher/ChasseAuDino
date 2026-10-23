// Bruitages synthétisés en Web Audio ; seuls les cris des animaux et les moteurs des voitures sont des
// enregistrements. Deux tons : 'kawaii' (aigu, joyeux) et 'mechant' (grave, grondant). iOS exige debloquer() dans un geste utilisateur ;
// le bouton silencieux de l'iPhone coupe aussi ces sons.

import { ESPECES, estVoiture } from './especes.js';

export function creerSons() {
  let ctx = null;
  let bruitBlanc = null;

  function debloquer() {
    if (!ctx) {
      const Contexte = window.AudioContext || window.webkitAudioContext;
      if (!Contexte) return;
      ctx = new Contexte();
      bruitBlanc = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = bruitBlanc.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    precharger();
  }

  // Enveloppe : montée rapide puis décroissance exponentielle jusqu'à `duree`.
  function enveloppe(debut, duree, volume) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, debut);
    g.gain.exponentialRampToValueAtTime(volume, debut + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, debut + duree);
    g.connect(ctx.destination);
    return g;
  }

  function note(type, f0, f1, decalage, duree, volume) {
    const t = ctx.currentTime + decalage;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + duree);
    o.connect(enveloppe(t, duree, volume));
    o.start(t);
    o.stop(t + duree + 0.05);
    return o;
  }

  function bruit(filtre, f0, f1, decalage, duree, volume) {
    const t = ctx.currentTime + decalage;
    const src = ctx.createBufferSource();
    src.buffer = bruitBlanc;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filtre;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + duree);
    src.connect(f).connect(enveloppe(t, duree, volume));
    src.start(t);
    src.stop(t + duree + 0.05);
  }

  // Cris des animaux (sons/<clé d'espèce>.wav) et moteurs des voitures (sons/moteur-<nom>.wav, un
  // tiré au hasard par aliment) : vrais enregistrements, voir le README pour les crédits, décodés
  // une fois après le déblocage de l'audio. null : en cours de chargement.
  const MOTEURS = ['plymouth', 'thunderbird', 'austin'].map((m) => `moteur-${m}`);
  const SONS = ['chat', 'chien', 'cheval', 'mouton', 'vache', ...MOTEURS];
  const cris = {};
  function precharger() {
    for (const cle of SONS) {
      if (cle in cris) continue;
      cris[cle] = null;
      fetch(`sons/${cle}.wav`)
        .then((r) => r.arrayBuffer())
        .then((donnees) => new Promise((ok, ko) => ctx.decodeAudioData(donnees, ok, ko)))
        .then((tampon) => { cris[cle] = tampon; aJouer(); })
        .catch((e) => { delete cris[cle]; console.error(e); });
    }
  }
  // Son en cours : un nouveau son coupe le précédent (fondu rapide) au lieu d'être ignoré.
  let enCours = null;
  function couper() {
    if (!enCours) return;
    const { src, g } = enCours;
    enCours = null;
    try {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
      src.stop(ctx.currentTime + 0.1);
    } catch (e) { /* déjà arrêté */ }
  }
  function crier(son) {
    couper();
    const g = ctx.createGain();
    g.gain.value = 0.85;
    g.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = cris[son];
    src.connect(g);
    src.onended = () => { if (enCours && enCours.src === src) enCours = null; };
    src.start();
    enCours = { src, g };
  }

  // L'audio d'iOS peut se suspendre (appel, changement d'application) : chaque son tente de le
  // réveiller, et un son demandé avant la fin du chargement part dès que son tampon est prêt.
  function pret() {
    if (!ctx) return false;
    if (ctx.state !== 'running') Promise.resolve(ctx.resume()).catch(() => {});
    return true;
  }
  let enAttente = null; // { cle, hasard, t } : son demandé avant la fin du chargement
  const ATTENTE_MAX_MS = 3000;
  function aJouer() {
    if (!enAttente) return;
    const { cle, hasard, t } = enAttente;
    if (performance.now() - t > ATTENTE_MAX_MS) { enAttente = null; return; }
    const son = sonDe(cle, hasard);
    if (!son) return;
    enAttente = null;
    crier(son);
  }

  // Son d'une espèce : son cri, ou pour un aliment un moteur tiré au hasard parmi ceux chargés.
  function sonDe(cle, hasard) {
    if (ESPECES[cle] && estVoiture(ESPECES[cle].classe)) {
      const prets = MOTEURS.filter((m) => cris[m]);
      return prets.length ? prets[Math.floor(hasard() * prets.length)] : null;
    }
    return cris[cle] ? cle : null;
  }
  function jouer(cle, hasard) {
    if (!pret()) return false;
    const son = sonDe(cle, hasard);
    if (son) crier(son);
    else enAttente = { cle, hasard, t: performance.now() };
    return !!son;
  }

  return {
    debloquer,

    // Cri de l'animal (ou moteur de l'aliment) d'espèce `cle`, à son apparition : toujours joué, en
    // coupant le son précédent.
    cri(cle, hasard = Math.random) {
      jouer(cle, hasard);
    },

    lancer() {
      if (!pret()) return;
      bruit('bandpass', 400, 1800, 0.12, 0.3, 0.35); // fouet de la main
    },

    splat() {
      if (!pret()) return;
      bruit('lowpass', 900, 150, 0, 0.25, 0.8); // tomate écrasée
      note('sine', 180, 60, 0, 0.15, 0.3);
    },

    explosion(ton) {
      if (!pret()) return;
      if (ton === 'kawaii') {
        note('sine', 500, 1500, 0, 0.1, 0.4); // pop
        [1047, 1319, 1568, 2093].forEach((f, i) => note('triangle', f, f, 0.08 + i * 0.07, 0.25, 0.2));
        bruit('highpass', 6000, 9000, 0.05, 0.5, 0.08); // pétillement
      } else {
        bruit('lowpass', 1200, 80, 0, 1.2, 0.9); // grondement
        note('sine', 120, 30, 0, 0.8, 0.6);
      }
    },

    // Fuite : l'animal pousse son cri et l'aliment démarre en trombe (coupant le son précédent) ; à
    // défaut d'enregistrement chargé, bruit synthétisé.
    fuite(ton, cle, hasard = Math.random) {
      if (!pret()) return;
      const son = sonDe(cle, hasard);
      if (son) {
        crier(son);
      } else if (ton === 'kawaii') {
        note('sine', 600, 1300, 0, 0.18, 0.25);
        note('sine', 700, 1500, 0.2, 0.18, 0.25);
      } else {
        [0, 0.18, 0.36].forEach((d) => note('sawtooth', 170, 110, d, 0.15, 0.12)); // ricanement
      }
    },
  };
}
