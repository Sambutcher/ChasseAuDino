#!/usr/bin/env python3
"""Génère les icônes de la PWA (nécessite Pillow) : python3 tools/icons.py"""
from pathlib import Path

from PIL import Image, ImageDraw

DOSSIER = Path(__file__).resolve().parent.parent / "icons"
ECHELLE = 4  # dessin sur-échantillonné puis réduit pour lisser les bords


def icone(taille):
    t = taille * ECHELLE
    img = Image.new("RGB", (t, t), "#16261b")
    d = ImageDraw.Draw(img)
    u = t / 100  # unité : 1 % de l'icône

    def ellipse(x0, y0, x1, y1, couleur):
        d.ellipse([x0 * u, y0 * u, x1 * u, y1 * u], fill=couleur)

    def poly(points, couleur):
        d.polygon([(x * u, y * u) for x, y in points], fill=couleur)

    # Petit dino kawaii (corps rond, grosse tête), comme la créature du jeu.
    violet, ventre, piques = "#8e5bd6", "#f4c56a", "#f08bb4"
    poly([(30, 70), (14, 78), (12, 72), (32, 62)], violet)  # queue
    for x in (36, 44, 52):  # piques du dos
        poly([(x, 46), (x + 4, 38), (x + 8, 46)], piques)
    ellipse(30, 42, 66, 80, violet)  # corps
    ellipse(38, 56, 60, 78, ventre)  # ventre
    ellipse(34, 74, 44, 84, violet)  # pattes
    ellipse(52, 74, 62, 84, violet)
    ellipse(48, 20, 82, 50, violet)  # tête
    ellipse(66, 28, 74, 36, "#ffffff")  # œil
    ellipse(69, 30, 73, 35, "#111111")
    ellipse(72, 40, 78, 44, piques)  # joue

    # Viseur doré par-dessus.
    or_, e = "#d4a017", max(1, round(2.2 * u))
    d.ellipse([22 * u, 22 * u, 78 * u, 78 * u], outline=or_, width=e)
    for x0, y0, x1, y1 in ((50, 6, 50, 26), (50, 74, 50, 94), (6, 50, 26, 50), (74, 50, 94, 50)):
        d.line([x0 * u, y0 * u, x1 * u, y1 * u], fill=or_, width=e)
    return img.resize((taille, taille), Image.LANCZOS)


DOSSIER.mkdir(exist_ok=True)
for nom, taille in (("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)):
    icone(taille).save(DOSSIER / nom, optimize=True)
    print(DOSSIER / nom)
