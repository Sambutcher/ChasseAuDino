import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESPECES } from '../js/especes.js';
import { creerSons } from '../js/sons.js';

// Faux Web Audio : compte les oscillateurs démarrés, accepte tous les branchements.
function fauxAudio() {
  const compte = { oscillateurs: 0 };
  const parametre = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const noeud = () => {
    const n = {
      frequency: parametre(), gain: parametre(), Q: parametre(),
      connect: (autre) => autre, start() {}, stop() {},
    };
    return n;
  };
  class Contexte {
    constructor() { this.state = 'running'; this.sampleRate = 100; this.currentTime = 0; this.destination = noeud(); }
    createBuffer() { return { getChannelData: () => new Float32Array(100) }; }
    createOscillator() { compte.oscillateurs++; return noeud(); }
    createGain() { return noeud(); }
    createBiquadFilter() { return noeud(); }
    createBufferSource() { return noeud(); }
    resume() {}
  }
  globalThis.window = { AudioContext: Contexte };
  return compte;
}

test('cris : un par animal, aucun pour un aliment, délai entre deux cris', () => {
  const compte = fauxAudio();
  const sons = creerSons();
  sons.debloquer();
  const animaux = Object.keys(ESPECES).filter((cle) => ESPECES[cle].clips);
  assert.equal(animaux.length, 5);
  let t = 0;
  for (const cle of animaux) {
    const avant = compte.oscillateurs;
    sons.cri(cle, (t += 10000));
    assert.ok(compte.oscillateurs > avant, `${cle} crie`);
  }
  const avant = compte.oscillateurs;
  sons.cri('burger', (t += 10000));
  assert.equal(compte.oscillateurs, avant, 'pas de cri pour un aliment');
  sons.cri('vache', (t += 10000));
  const apres = compte.oscillateurs;
  sons.cri('chien', t + 1000);
  assert.equal(compte.oscillateurs, apres, 'trop tôt pour un autre cri');
});

test('cris : rien tant que l\'audio n\'est pas débloqué', () => {
  const compte = fauxAudio();
  const sons = creerSons();
  sons.cri('vache', 99999);
  assert.equal(compte.oscillateurs, 0);
});

test('fuite : l\'animal crie malgré le délai, l\'aliment fait son bruit de fuite', () => {
  const compte = fauxAudio();
  const sons = creerSons();
  sons.debloquer();
  sons.cri('chat', performance.now()); // apparition
  const apres = compte.oscillateurs;
  sons.fuite('kawaii', 'chat');
  assert.ok(compte.oscillateurs > apres, 'cri à la fuite');
  const avant = compte.oscillateurs;
  sons.fuite('kawaii', 'burger');
  assert.ok(compte.oscillateurs > avant, 'bruit de fuite d\'un aliment');
});
