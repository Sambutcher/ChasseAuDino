// Animation des créatures riggées : lecture des clips du modèle (AnimationMixer) avec fondus
// enchaînés, plus un frémissement des oreilles et de la queue. Fonctionne sous Node (pas de WebGL).
//   attente : clip joué en boucle ; mimiques : clips joués une fois puis retour à l'attente ;
//   fuite : clip de course en boucle ; tete : clips de tête baissée (le premier qui existe).
import * as THREE from '../vendor/three.module.min.js';

const FONDU = 0.3; // s
const FONDU_FUITE = 0.12;
const OREILLE = /^Ear\d/;
const QUEUE = /^Tail\d/;

// Clips voulus par chaque espèce : espece.clips = { attente, mimiques, fuite, tete }.
export function creerClips(racine, animations, config) {
  const mixer = new THREE.AnimationMixer(racine);
  const actions = new Map();
  const trouver = (nom) => animations.find((a) => a.name.toLowerCase() === nom.toLowerCase());
  const action = (nom) => {
    if (!actions.has(nom)) {
      const clip = trouver(nom);
      actions.set(nom, clip ? mixer.clipAction(clip) : null);
    }
    return actions.get(nom);
  };
  const mimiques = config.mimiques.filter((nom) => action(nom));
  const tete = config.tete.find((nom) => action(nom)) ?? null;

  const os = { oreilles: [], queue: [] };
  racine.traverse((o) => {
    if (!o.isBone) return;
    if (OREILLE.test(o.name)) os.oreilles.push(o);
    else if (QUEUE.test(o.name)) os.queue.push(o);
  });

  let courante = null;
  let etat = 'attente'; // 'attente' | 'mimique' | 'fuite'
  let baissee = false; // tête baissée : l'animal broute
  let temps = 0;
  const q = new THREE.Quaternion();
  const axeZ = new THREE.Vector3(0, 0, 1);
  const axeX = new THREE.Vector3(1, 0, 0);

  const base = () => (baissee && tete ? tete : config.attente);

  function jouer(nom, { unique = false, fondu = FONDU } = {}) {
    const suivante = action(nom);
    if (!suivante || suivante === courante) return;
    suivante.reset();
    suivante.setLoop(unique ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    suivante.clampWhenFinished = unique;
    if (courante) suivante.crossFadeFrom(courante, fondu, false);
    suivante.play();
    courante = suivante;
  }

  mixer.addEventListener('finished', (e) => {
    if (etat === 'mimique' && e.action === courante) {
      etat = 'attente';
      jouer(base());
    }
  });

  return {
    mimiques: mimiques.length,
    get etat() { return etat; },
    get clip() { return courante?.getClip().name ?? null; },
    demarrer() {
      mixer.stopAllAction();
      courante = null;
      etat = 'attente';
      baissee = false;
      jouer(config.attente, { fondu: 0 });
      mixer.update(0);
    },
    arreter() { this.demarrer(); },
    mimique(i) {
      if (etat === 'fuite' || !mimiques.length) return;
      etat = 'mimique';
      jouer(mimiques[i % mimiques.length], { unique: true });
    },
    fuir() {
      etat = 'fuite';
      jouer(config.fuite, { fondu: FONDU_FUITE });
    },
    // Tête baissée (l'animal broute ou renifle) ou relevée ; sans effet pendant une mimique ou la fuite.
    teteBaissee(oui) {
      if (oui === baissee) return;
      baissee = oui;
      if (etat === 'attente') jouer(base());
    },
    maj(dt) {
      mixer.update(dt);
      temps += dt;
      // Frémissement ajouté à la pose du clip (le mixer la réécrit à chaque image).
      const vif = etat === 'fuite' ? 2.2 : 1;
      os.oreilles.forEach((o, i) => {
        q.setFromAxisAngle(axeZ, 0.07 * vif * Math.sin(temps * 7 * vif + i * 1.7));
        o.quaternion.multiply(q);
      });
      os.queue.forEach((o, i) => {
        q.setFromAxisAngle(axeX, 0.05 * vif * Math.sin(temps * 3.5 * vif - i * 0.8));
        o.quaternion.multiply(q);
        q.setFromAxisAngle(axeZ, 0.07 * vif * Math.sin(temps * 3 * vif - i * 0.8));
        o.quaternion.multiply(q);
      });
    },
  };
}
