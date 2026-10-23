// Bruitages synthétisés en Web Audio, sans fichier son. Deux tons : 'kawaii' (aigu, joyeux)
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

  // Voix d'animal : dent de scie dont la hauteur suit `points` ([secondes, Hz]…), filtrée par des
  // formants (les « voyelles »), tenue puis relâchée ; vibrato optionnel (Hz, profondeur en Hz).
  function voix(points, decalage, volume, formants, vibrato = null) {
    const t = ctx.currentTime + decalage;
    const duree = points[points.length - 1][0];
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(points[0][1], t);
    for (const [dt, f] of points.slice(1)) o.frequency.exponentialRampToValueAtTime(f, t + dt);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = vibrato[0];
      const amplitude = ctx.createGain();
      amplitude.gain.value = vibrato[1];
      lfo.connect(amplitude).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + duree + 0.05);
    }
    const sortie = ctx.createGain();
    sortie.gain.setValueAtTime(0.0001, t);
    sortie.gain.linearRampToValueAtTime(volume, t + Math.min(0.04, duree / 4));
    sortie.gain.setValueAtTime(volume, t + duree * 0.7);
    sortie.gain.linearRampToValueAtTime(0.0001, t + duree);
    sortie.connect(ctx.destination);
    for (const f of formants) {
      const filtre = ctx.createBiquadFilter();
      filtre.type = 'bandpass';
      filtre.frequency.value = f;
      filtre.Q.value = 3;
      o.connect(filtre).connect(sortie);
    }
    o.start(t);
    o.stop(t + duree + 0.05);
  }

  // Cris des animaux du jeu, par clé d'espèce (js/especes.js).
  const CRIS = {
    chien: () => { // ouaf ouaf
      voix([[0, 480], [0.06, 400], [0.14, 300]], 0, 0.3, [700, 1300]);
      voix([[0, 500], [0.06, 420], [0.14, 310]], 0.2, 0.3, [700, 1300]);
    },
    chat: () => { // jappement aigu de renard
      voix([[0, 900], [0.12, 1700]], 0, 0.22, [1500, 3000]);
      voix([[0, 1500], [0.22, 700]], 0.13, 0.22, [1400, 2800], [30, 60]);
    },
    cheval: () => { // hennissement : montée, puis chute tremblée
      voix([[0, 450], [0.25, 950], [0.9, 380]], 0, 0.3, [800, 2100], [14, 45]);
    },
    mouton: () => { // mèèè tremblé
      voix([[0, 380], [0.15, 470], [0.65, 400]], 0, 0.3, [900, 1800], [28, 55]);
    },
    vache: () => { // meuh : grave, qui monte un peu puis retombe
      voix([[0, 110], [0.3, 150], [0.95, 95]], 0, 0.45, [500, 1000], [5, 6]);
    },
  };
  const DELAI_CRI_MS = 6000; // entre deux cris, pour ne pas saturer
  let dernierCri = -Infinity;

  const pret = () => ctx && ctx.state === 'running';

  return {
    debloquer,

    // Cri de l'animal d'espèce `cle` à son apparition ; rien pour un aliment, ni si le dernier cri
    // est trop récent (une détection qui clignote le ferait répéter).
    cri(cle, t = performance.now()) {
      if (!pret() || !CRIS[cle] || t - dernierCri < DELAI_CRI_MS) return;
      dernierCri = t;
      CRIS[cle]();
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
      if (CRIS[cle]) {
        dernierCri = performance.now();
        CRIS[cle]();
      } else if (ton === 'kawaii') {
        note('sine', 600, 1300, 0, 0.18, 0.25);
        note('sine', 700, 1500, 0.2, 0.18, 0.25);
      } else {
        [0, 0.18, 0.36].forEach((d) => note('sawtooth', 170, 110, d, 0.15, 0.12)); // ricanement
      }
    },
  };
}
