// Dessin 2D plein écran (coordonnées en points CSS), sur deux canvas qui encadrent celui des
// créatures 3D : la vidéo dessous, l'interface (viseur, messages, course) dessus.
import { placementVideo } from './geometry.js';

export function creerRendu(canvasVideo, canvas) {
  const ctxVideo = canvasVideo.getContext('2d');
  const ctx = canvas.getContext('2d');
  let largeur = 0;
  let hauteur = 0;
  let margeHaut = 0;

  function redimensionner() {
    const dpr = window.devicePixelRatio || 1;
    largeur = window.innerWidth;
    hauteur = window.innerHeight;
    for (const [c, contexte] of [[canvasVideo, ctxVideo], [canvas, ctx]]) {
      c.width = Math.round(largeur * dpr);
      c.height = Math.round(hauteur * dpr);
      contexte.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    margeHaut = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  }
  window.addEventListener('resize', redimensionner);
  redimensionner();

  // Vidéo entière, placée selon le cadrage (voir placementVideo : pas de découpe de la source).
  function video(source, c) {
    const ecran = { x: 0, y: 0, w: largeur, h: hauteur };
    const p = placementVideo(c, source.videoWidth, source.videoHeight, largeur, hauteur, ecran, ecran);
    ctxVideo.drawImage(source, p.x, p.y, p.w, p.h);
  }

  function effacer() {
    ctx.clearRect(0, 0, largeur, hauteur);
  }

  function rectArrondi(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Viseur discret au centre de l'écran : deux anneaux fins et translucides qui « respirent » et,
  // si la main attend, arc pointillé du lancer prévu (chemin(u)
  // → point écran, u de 0 à 1) dont les points avancent vers la cible. t : horloge en ms.
  function viseur(t, chemin) {
    const cx = largeur / 2;
    const cy = hauteur / 2;
    const r = Math.min(largeur, hauteur) * 0.1 * (1 + 0.04 * Math.sin((t / 1300) * 2 * Math.PI));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;

    if (chemin) {
      const n = 22;
      const phase = (t / 700) % 1;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < n; i++) {
        const u = (i + phase) / n;
        const p = chemin(u);
        if (Math.hypot(p.x - cx, p.y - cy) < r) continue; // pas de points dans la cible
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 - 1.5 * u, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    ctx.shadowBlur = 3;
    ctx.lineWidth = 1.6;
    for (const [k, couleur] of [[1, 'rgba(255,255,255,0.7)'], [0.5, 'rgba(255,110,90,0.8)']]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * k, 0, 2 * Math.PI);
      ctx.strokeStyle = couleur;
      ctx.stroke();
    }
    ctx.restore();
  }

  function message(texte) {
    ctx.save();
    ctx.font = '600 18px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = hauteur - 48;
    const w = ctx.measureText(texte).width + 32;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rectArrondi(largeur / 2 - w / 2, y - 20, w, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(texte, largeur / 2, y);
    ctx.restore();
  }

  function flash(resultat, intensite) {
    ctx.save();
    ctx.globalAlpha = 0.35 * intensite;
    ctx.fillStyle = resultat === 'touche' ? '#ffffff' : '#ff4136';
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.restore();
  }

  // Écran de course (caméra éteinte) : distance à vol d'oiseau depuis le départ (sans plafond)
  // et barre qui se remplit jusqu'à l'objectif, verte quand le tir est débloqué.
  // e = course.etat() ; alerte : message exceptionnel (localisation refusée…), sinon null.
  function course(e, alerte) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = largeur / 2;
    const debloque = e.phase === 'fini';

    const enCourse = e.phase === 'course' || debloque;
    ctx.fillStyle = debloque ? '#2ecc40' : '#fff';
    ctx.font = '700 96px -apple-system, system-ui, sans-serif';
    ctx.fillText(enCourse ? `${Math.floor(e.distance)} m` : '— m', cx, hauteur * 0.4);

    const bw = Math.min(largeur - 75, 300);
    const bh = 16;
    const bx = cx - bw / 2;
    const by = hauteur * 0.56;
    ctx.fillStyle = '#222';
    rectArrondi(bx, by, bw, bh, bh / 2);
    ctx.fill();
    const part = enCourse ? Math.min(1, e.distance / e.objectif) : 0;
    if (part > 0) {
      ctx.fillStyle = debloque ? '#2ecc40' : '#d4a017';
      rectArrondi(bx, by, Math.max(bh, bw * part), bh, bh / 2);
      ctx.fill();
    }

    if (alerte) {
      ctx.fillStyle = '#ff6b5b';
      ctx.font = '600 16px -apple-system, system-ui, sans-serif';
      ctx.fillText(alerte, cx, by + 48);
    }
    ctx.restore();
  }

  return {
    get largeur() { return largeur; },
    get hauteur() { return hauteur; },
    video, effacer, viseur, message, flash, course,
  };
}
