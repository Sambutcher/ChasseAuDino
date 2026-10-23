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

  const pret = () => ctx && ctx.state === 'running';

  return {
    debloquer,

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

    fuite(ton) {
      if (!pret()) return;
      if (ton === 'kawaii') {
        note('sine', 600, 1300, 0, 0.18, 0.25);
        note('sine', 700, 1500, 0.2, 0.18, 0.25);
      } else {
        [0, 0.18, 0.36].forEach((d) => note('sawtooth', 170, 110, d, 0.15, 0.12)); // ricanement
      }
    },

    humeur(ton) {
      if (!pret()) return;
      if (ton === 'kawaii') {
        note('sine', 900, 1500, 0, 0.12, 0.12); // pouic
      } else {
        // Grognement : dent de scie grave modulée en amplitude, filtrée.
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(85, t);
        o.frequency.linearRampToValueAtTime(65, t + 0.6);
        const trem = ctx.createOscillator();
        trem.frequency.value = 22;
        const profondeur = ctx.createGain();
        profondeur.gain.value = 0.5;
        const ampli = ctx.createGain();
        ampli.gain.value = 0.5;
        trem.connect(profondeur).connect(ampli.gain);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500;
        o.connect(ampli).connect(f).connect(enveloppe(t, 0.6, 0.3));
        o.start(t);
        trem.start(t);
        o.stop(t + 0.65);
        trem.stop(t + 0.65);
      }
    },
  };
}
