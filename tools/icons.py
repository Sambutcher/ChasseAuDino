#!/usr/bin/env python3
"""Génère les icônes de la PWA (nécessite Pillow, par ex. le Python du pipx ultralytics :
~/.local/share/pipx/venvs/ultralytics/bin/python tools/icons.py)."""
from pathlib import Path

from PIL import Image, ImageDraw

DOSSIER = Path(__file__).resolve().parent.parent / "icons"
ECHELLE = 4  # dessin sur-échantillonné puis réduit pour lisser les bords


def icone(taille):
    t = taille * ECHELLE
    img = Image.new("RGB", (t, t), "#111111")
    d = ImageDraw.Draw(img)
    # Plaque verticale à angles droits comme la cible du jeu, 3 ronds dont le premier blanchi.
    w, h = t * 0.34, t * 0.74
    x0, y0 = (t - w) / 2, (t - h) / 2
    d.rectangle([x0, y0, x0 + w, y0 + h], fill="#f4f4f0")
    r = min(w / 2, h / 6) * 0.65
    for i, f in enumerate((1 / 6, 1 / 2, 5 / 6)):
        cx, cy = t / 2, y0 + h * f
        boite = [cx - r, cy - r, cx + r, cy + r]
        if i == 0:
            d.ellipse(boite, fill="#ffffff", outline="#999999", width=ECHELLE * max(1, taille // 96))
        else:
            d.ellipse(boite, fill="#111111")
    return img.resize((taille, taille), Image.LANCZOS)


DOSSIER.mkdir(exist_ok=True)
for nom, taille in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
    icone(taille).save(DOSSIER / nom, optimize=True)
    print(DOSSIER / nom)
