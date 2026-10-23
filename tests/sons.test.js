import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESPECES } from '../js/especes.js';
import { creerSons } from '../js/sons.js';

// Faux Web Audio : compte les sources démarrées et arrêtées, mémorise les fichiers lus, accepte
// tous les branchements. `etat` : état initial du contexte ('running' ou 'suspended').
function fauxAudio({ lus = [], etat = 'running' } = {}) {
  const compte = { demarres: 0, arretes: 0, reveils: 0 };
  globalThis.fetch = async (url) => ({ arrayBuffer: async () => Object.assign(new ArrayBuffer(8), { url }) });
  const parametre = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  const noeud = () => ({
    frequency: parametre(), gain: parametre(), Q: parametre(),
    connect: (autre) => autre, start() {}, stop() {},
  });
  class Contexte {
    constructor() { this.state = etat; this.sampleRate = 100; this.currentTime = 0; this.destination = noeud(); }
    createBuffer() { return { getChannelData: () => new Float32Array(100) }; }
    createOscillator() { compte.demarres++; return noeud(); }
    createGain() { return noeud(); }
    createBiquadFilter() { return noeud(); }
    createBufferSource() {
      const n = noeud();
      n.start = () => { compte.demarres++; };
      n.stop = () => { compte.arretes++; };
      Object.defineProperty(n, 'buffer', { set: (b) => lus.push(b.url) });
      return n;
    }
    decodeAudioData(donnees, ok) { ok({ duration: 1, url: donnees.url }); }
    resume() { compte.reveils++; this.state = 'running'; }
  }
  globalThis.window = { AudioContext: Contexte };
  return compte;
}

const chargement = () => new Promise((r) => setTimeout(r, 10)); // décodage des enregistrements

test('cris : un par animal, un moteur par aliment, toujours joués à la suite', async () => {
  const compte = fauxAudio();
  const sons = creerSons();
  sons.debloquer();
  await chargement();
  const animaux = Object.keys(ESPECES).filter((cle) => ESPECES[cle].clips);
  assert.equal(animaux.length, 5);
  for (const cle of [...animaux, 'burger', 'vache', 'chien']) {
    const avant = compte.demarres;
    sons.cri(cle);
    assert.equal(compte.demarres, avant + 1, `${cle} : son démarré immédiatement`);
  }
});

test('un nouveau son coupe le précédent', async () => {
  const compte = fauxAudio();
  const sons = creerSons();
  sons.debloquer();
  await chargement();
  sons.cri('vache');
  assert.equal(compte.arretes, 0);
  sons.cri('chien');
  assert.equal(compte.arretes, 1, 'la vache est coupée');
  sons.fuite('kawaii', 'chien');
  assert.equal(compte.arretes, 2, 'le cri d\'apparition est coupé par celui de fuite');
});

test('moteurs : un aliment tire un moteur au hasard, tous différents possibles', async () => {
  const lus = [];
  fauxAudio({ lus });
  const sons = creerSons();
  sons.debloquer();
  await chargement();
  for (const h of [0, 0.5, 0.99]) sons.cri('sushi', () => h);
  assert.equal(new Set(lus).size, 3, `moteurs lus : ${[...new Set(lus)].join(', ')}`);
  assert.ok(lus.every((u) => u.startsWith('sons/moteur-')));
});

test('cris : rien tant que l\'audio n\'est pas débloqué', () => {
  const compte = fauxAudio();
  const sons = creerSons();
  sons.cri('vache');
  assert.equal(compte.demarres, 0);
});

test('un son demandé avant la fin du chargement part dès que son tampon est prêt', async () => {
  const lus = [];
  const compte = fauxAudio({ lus });
  const sons = creerSons();
  sons.debloquer(); // chargement lancé, rien de décodé encore
  sons.cri('cheval');
  assert.equal(compte.demarres, 0);
  await chargement();
  assert.equal(compte.demarres, 1, 'le cri part au chargement');
  assert.deepEqual(lus, ['sons/cheval.wav']);
});

test('audio suspendu (iOS) : réveillé à chaque son, qui part quand même', async () => {
  const compte = fauxAudio({ etat: 'suspended' });
  const sons = creerSons();
  sons.debloquer();
  await chargement();
  sons.cri('chat');
  assert.ok(compte.demarres >= 1, 'cri démarré');
  assert.ok(compte.reveils >= 1, 'contexte réveillé');
});

test('fuite : l\'animal crie, l\'aliment démarre un moteur', async () => {
  const lus = [];
  fauxAudio({ lus });
  const sons = creerSons();
  sons.debloquer();
  await chargement();
  sons.fuite('kawaii', 'chat');
  sons.fuite('kawaii', 'burger', () => 0);
  assert.deepEqual(lus, ['sons/chat.wav', 'sons/moteur-plymouth.wav']);
});
