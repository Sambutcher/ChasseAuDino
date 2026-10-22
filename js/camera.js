// Caméra arrière dans un <video> caché, éteinte pendant les courses pour la batterie.

const FIGEE_RELANCE_MS = 1500; // image immobile depuis ce délai : on relance la lecture
const FIGEE_REDEMARRAGE_MS = 4000; // toujours immobile : on redémarre la caméra

export async function demarrerCamera(video) {
  const flux = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
  });
  video.srcObject = flux;
  video.muted = true;
  video.playsInline = true;
  // Dimensions connues avant de lancer la lecture (après la fenêtre d'autorisation d'iOS, la
  // vidéo pouvait rester figée sur sa première image).
  if (video.readyState < 1) await new Promise((ok) => video.addEventListener('loadedmetadata', ok, { once: true }));
  await video.play();
  return video;
}

export function arreterCamera(video) {
  if (video.srcObject) video.srcObject.getTracks().forEach((piste) => piste.stop());
  video.srcObject = null;
}

// Surveillance d'une vidéo qui se fige (iOS, juste après l'autorisation de la caméra ou au retour
// sur la page) : à appeler à chaque image pendant le tir. Relance la lecture, puis redémarre la
// caméra si l'image reste immobile.
export function creerGardien(video) {
  let dernierTemps = -1;
  let immobileDepuis = null;
  let redemarrage = false;
  let relance = false; // play() déjà relancé pour cette immobilité

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && video.srcObject) video.play().catch(() => {});
  });

  return {
    verifier(t) {
      if (!video.srcObject || redemarrage) return;
      if (video.currentTime !== dernierTemps) {
        dernierTemps = video.currentTime;
        immobileDepuis = null;
        relance = false;
        return;
      }
      immobileDepuis ??= t;
      const duree = t - immobileDepuis;
      if (duree > FIGEE_REDEMARRAGE_MS) {
        redemarrage = true;
        arreterCamera(video);
        demarrerCamera(video)
          .catch((e) => console.error('Redémarrage caméra :', e))
          .finally(() => {
            redemarrage = false;
            immobileDepuis = null;
            relance = false;
          });
      } else if (duree > FIGEE_RELANCE_MS && !relance) {
        relance = true;
        video.play().catch(() => {});
      }
    },
    oublier() {
      dernierTemps = -1;
      immobileDepuis = null;
      relance = false;
    },
  };
}
