// Animation en code des créatures statiques (sans squelette) : respiration en attente, mimique
// (saut ou tortillement), fuite en sautillant. Logique pure : une pose est un petit
// déplacement du corps entier, en hauteurs de créature, appliqué autour des pieds.
//   dy : montée ; sx, sy : étirement horizontal et vertical (écrasement à la réception) ;
//   roulis, tangage : inclinaison de côté et vers l'avant (radians).

export const DUREE_HUMEUR = 0.9; // s
export const VARIANTES_HUMEUR = 2; // saut, tortillement
const PERIODE_RESPIRATION = 2.4; // s
const FOULEES_PAR_SECONDE = 2.8;

const NEUTRE = { dy: 0, sx: 1, sy: 1, roulis: 0, tangage: 0 };

// Pose de l'état 'attente' | 'humeur' | 'fuite' à t secondes de son début (variante : 0 ou 1).
export function pose(etat, t, variante = 0) {
  if (etat === 'humeur') {
    const u = Math.min(1, t / DUREE_HUMEUR);
    if (variante === 0) {
      // Accroupi, bond, réception écrasée.
      const bond = Math.sin(Math.PI * u);
      const ecrase = u < 0.2 ? Math.sin((u / 0.2) * Math.PI) * 0.08 : u > 0.85 ? Math.sin(((u - 0.85) / 0.15) * Math.PI) * 0.06 : 0;
      return { dy: 0.22 * bond, sx: 1 + ecrase * 0.6 - bond * 0.04, sy: 1 - ecrase + bond * 0.06, roulis: 0, tangage: 0 };
    }
    const ampleur = Math.sin(Math.PI * u);
    return { ...NEUTRE, roulis: 0.22 * Math.sin(u * Math.PI * 6) * ampleur, dy: 0.03 * Math.abs(Math.sin(u * Math.PI * 6)) * ampleur };
  }
  if (etat === 'fuite') {
    const phase = t * FOULEES_PAR_SECONDE * Math.PI;
    const saut = Math.abs(Math.sin(phase));
    const reception = Math.pow(1 - saut, 6) * 0.07;
    return { dy: 0.16 * saut, sx: 1 + reception, sy: 1 - reception, roulis: 0.06 * Math.sin(phase), tangage: 0.12 };
  }
  const souffle = Math.sin((2 * Math.PI * t) / PERIODE_RESPIRATION);
  return { dy: 0, sx: 1 - 0.008 * souffle, sy: 1 + 0.018 * souffle, roulis: 0.025 * Math.sin((2 * Math.PI * t) / (PERIODE_RESPIRATION * 1.3)), tangage: 0 };
}

// Automate d'une créature : on demande un état, maj(dt) donne la pose courante. Une mimique
// terminée revient seule à l'attente.
export function creerAnimation() {
  let etat = 'attente';
  let variante = 0;
  let t = 0;
  return {
    get etat() { return etat; },
    attente() { etat = 'attente'; t = 0; },
    humeur(v = 0) { etat = 'humeur'; variante = v % VARIANTES_HUMEUR; t = 0; },
    fuite() { etat = 'fuite'; t = 0; },
    maj(dt) {
      t += dt;
      if (etat === 'humeur' && t >= DUREE_HUMEUR) {
        etat = 'attente';
        t = 0;
      }
      return pose(etat, t, variante);
    },
  };
}
