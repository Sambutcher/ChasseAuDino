// Position GPS pendant toute la partie, et écran maintenu allumé (iOS coupe le GPS des pages
// web quand l'écran se verrouille). Mode simulation pour tester sans courir.

// Appelle rappel({ lat, lon, precision, t }) à chaque position, rappelErreur(message) si le GPS
// est refusé ou absent.
export function suivrePosition(rappel, rappelErreur, { simulation = false } = {}) {
  if (simulation) return simulerCourse(rappel);
  if (!('geolocation' in navigator)) {
    rappelErreur('GPS indisponible sur cet appareil');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (p) => rappel({ lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy, t: Date.now() }),
    // Seul le refus est signalé ; une attente du GPS (délai, signal perdu) se résout d'elle-même.
    (e) => { if (e.code === 1) rappelErreur('Autorisez la localisation pour courir'); },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

// Course simulée vers le nord à ~3 m/s, bruit de ±2 m, une position par seconde.
function simulerCourse(rappel) {
  const depart = { lat: 48.8566, lon: 2.3522 };
  const debut = Date.now();
  const bruit = () => (Math.random() - 0.5) * 4;
  const id = setInterval(() => {
    const t = Date.now();
    const nord = ((t - debut) / 1000) * 3 + bruit();
    const est = bruit();
    rappel({
      lat: depart.lat + nord / 111195,
      lon: depart.lon + est / (111195 * Math.cos((depart.lat * Math.PI) / 180)),
      precision: 8,
      t,
    });
  }, 1000);
  return () => clearInterval(id);
}

// Empêche la mise en veille de l'écran, et le redemande au retour sur la page.
export function garderEcranAllume() {
  if (!('wakeLock' in navigator)) return;
  const demander = () => navigator.wakeLock.request('screen').catch((e) => console.warn('Wake Lock :', e));
  demander();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') demander();
  });
}
