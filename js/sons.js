// Bruitages synthétisés en Web Audio ; seuls les cris des animaux sont des enregistrements. Deux tons : 'kawaii' (aigu, joyeux)
// et 'mechant' (grave, grondant). iOS exige debloquer() dans un geste utilisateur ;
// le bouton silencieux de l'iPhone coupe aussi ces sons.

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

  // Cris des animaux : vrais enregistrements (sons/<clé d'espèce>.wav, voir le README pour les
  // crédits), décodés une fois après le déblocage de l'audio. null : en cours de chargement.
  const ESPECES_CRI = ['chat', 'chien', 'cheval', 'mouton', 'vache'];
  const cris = {};
  function precharger() {
    for (const cle of ESPECES_CRI) {
      if (cle in cris) continue;
      cris[cle] = null;
      fetch(`sons/${cle}.wav`)
        .then((r) => r.arrayBuffer())
        .then((donnees) => new Promise((ok, ko) => ctx.decodeAudioData(donnees, ok, ko)))
        .then((tampon) => { cris[cle] = tampon; })
        .catch((e) => { delete cris[cle]; console.error(e); });
    }
  }
  function crier(cle) {
    const g = ctx.createGain();
    g.gain.value = 0.85;
    g.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = cris[cle];
    src.connect(g);
    src.start();
  }
  const DELAI_CRI_MS = 6000; // entre deux cris, pour ne pas saturer
  let dernierCri = -Infinity;

  const pret = () => ctx && ctx.state === 'running';
  const aCri = (cle) => !!cris[cle];

  return {
    debloquer,

    // Cri de l'animal d'espèce `cle` à son apparition ; rien pour un aliment, ni si le dernier cri
    // est trop récent (une détection qui clignote le ferait répéter).
    cri(cle, t = performance.now()) {
      if (!pret() || !aCri(cle) || t - dernierCri < DELAI_CRI_MS) return;
      dernierCri = t;
      crier(cle);
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

    // Fuite : l'animal pousse son cri (toujours, sans délai) ; un aliment fait son bruit de fuite.
    fuite(ton, cle) {
      if (!pret()) return;
      if (aCri(cle)) {
        dernierCri = performance.now();
        crier(cle);
      } else if (ton === 'kawaii') {
        note('sine', 600, 1300, 0, 0.18, 0.25);
        note('sine', 700, 1500, 0.2, 0.18, 0.25);
      } else {
        [0, 0.18, 0.36].forEach((d) => note('sawtooth', 170, 110, d, 0.15, 0.12)); // ricanement
      }
    },
  };
}
