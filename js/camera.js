// Caméra arrière dans un <video> caché, éteinte pendant les courses pour la batterie.

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

// Au retour sur la page (fenêtre d'autorisation, changement d'app), iOS peut laisser la vidéo en
// pause : on relance la lecture. (Pas de surveillance de video.currentTime : avec un flux caméra,
// Safari ne le fait pas avancer de façon fiable, et la caméra était redémarrée sans cesse.)
export function relancerAuRetour(video) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && video.srcObject) video.play().catch(() => {});
  });
}
