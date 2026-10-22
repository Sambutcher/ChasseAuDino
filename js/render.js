// Dessin 2D plein écran (coordonnées en points CSS), sur deux canvas qui encadrent celui des
// créatures 3D : la vidéo dessous, l'interface (viseur, cartouche, messages, course) dessus.
import { CARTOUCHES } from './game.js';

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

  function video(source, c) {
    ctxVideo.drawImage(source, c.sx, c.sy, c.sw, c.sh, 0, 0, largeur, hauteur);
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

  function viseur() {
    const cx = largeur / 2;
    const cy = hauteur / 2;
    const r = Math.min(largeur, hauteur) * 0.12;
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(cx + dx * r * 0.3, cy + dy * r * 0.3);
      ctx.lineTo(cx + dx * r * 1.4, cy + dy * r * 1.4);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }

  function cartouches(restantes) {
    const w = 18;
    const h = 56;
    const y = margeHaut + 16;
    ctx.save();
    for (let i = 0; i < CARTOUCHES; i++) {
      const x = 16 + i * (w + 10);
      const pleine = i < restantes;
      // Douille
      ctx.fillStyle = pleine ? '#d4a017' : 'rgba(255,255,255,0.15)';
      ctx.strokeStyle = pleine ? '#7a5a00' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(x, y + h * 0.35, w, h * 0.65);
      ctx.strokeRect(x, y + h * 0.35, w, h * 0.65);
      // Ogive
      ctx.beginPath();
      ctx.moveTo(x, y + h * 0.35);
      ctx.quadraticCurveTo(x, y, x + w / 2, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + h * 0.35);
      ctx.closePath();
      ctx.fillStyle = pleine ? '#b87333' : 'rgba(255,255,255,0.15)';
      ctx.fill();
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

  // Cadre de la zone analysée par le modèle (mode debug).
  function zone(z) {
    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = z.type === 'cible' ? '#0f0' : z.type === 'centre' ? '#0cf' : '#ff0';
    ctx.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
    ctx.restore();
  }

  function diagnostic(lignes) {
    ctx.save();
    ctx.font = '12px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(largeur - 150, margeHaut + 12, 142, lignes.length * 15 + 8);
    ctx.fillStyle = '#0f0';
    lignes.forEach((l, i) => ctx.fillText(l, largeur - 14, margeHaut + 16 + i * 15));
    ctx.restore();
  }

  return {
    get largeur() { return largeur; },
    get hauteur() { return hauteur; },
    video, effacer, viseur, cartouches, message, flash, course, zone, diagnostic,
  };
}
