#!/usr/bin/env python3
"""Convertit le jeu de données Animal Pose (Kaggle bloodaxe/animal-pose-dataset : keypoints.json au
format COCO, 20 points par animal, 5 espèces) au format YOLO-pose d'Ultralytics.

Usage : python3 tools/preparer_pose.py <dossier du dataset> <dossier de sortie> [part de validation]
Le dossier du dataset contient keypoints.json et images/images/*.jpg|jpeg|png.
Sortie : <sortie>/images/{train,val}, <sortie>/labels/{train,val} et <sortie>/data.yaml.
La séparation train/val se fait par image (graine fixe), jamais par animal.
"""
import json
import os
import random
import shutil
import sys
from pathlib import Path

from PIL import Image

# Ordre des classes YOLO (celui du jeu de données moins 1) → classe COCO du jeu.
CLASSES = ["dog", "cat", "sheep", "horse", "cow"]
# Symétrie gauche/droite des 20 points, pour le retournement horizontal pendant l'entraînement :
# yeux, oreilles, coudes, genoux et pattes se croisent ; nez, gorge, garrot et queue restent.
FLIP_IDX = [1, 0, 2, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15, 17, 18, 19]
NOMS_POINTS = [
    "left_eye", "right_eye", "nose", "left_ear", "right_ear", "left_front_elbow", "right_front_elbow",
    "left_back_elbow", "right_back_elbow", "left_front_knee", "right_front_knee", "left_back_knee",
    "right_back_knee", "left_front_paw", "right_front_paw", "left_back_paw", "right_back_paw",
    "throat", "withers", "tailbase",
]


def ligne(annotation, largeur, hauteur):
    x, y, w, h = annotation["bbox"]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(largeur, x + w), min(hauteur, y + h)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    morceaux = [annotation["category_id"] - 1, (x0 + x1) / 2 / largeur, (y0 + y1) / 2 / hauteur,
                (x1 - x0) / largeur, (y1 - y0) / hauteur]
    for px, py, v in annotation["keypoints"]:
        if v and 0 <= px <= largeur and 0 <= py <= hauteur:
            morceaux += [px / largeur, py / hauteur, 2]
        else:
            morceaux += [0, 0, 0]
    return " ".join(f"{m:.6f}" if isinstance(m, float) else str(m) for m in morceaux)


def preparer(dataset, sortie, validation=0.1, graine=7):
    dataset, sortie = Path(dataset), Path(sortie)
    j = json.loads((dataset / "keypoints.json").read_text())
    noms = {int(i): n for i, n in j["images"].items()}
    par_image = {}
    for a in j["annotations"]:
        par_image.setdefault(a["image_id"], []).append(a)

    ids = sorted(par_image)
    random.Random(graine).shuffle(ids)
    n_val = round(len(ids) * validation)
    parts = {i: ("val" if k < n_val else "train") for k, i in enumerate(ids)}

    for dossier in ("images", "labels"):
        for part in ("train", "val"):
            (sortie / dossier / part).mkdir(parents=True, exist_ok=True)
    compte = {"train": 0, "val": 0, "animaux": 0}
    for i, annotations in par_image.items():
        source = dataset / "images" / "images" / noms[i]
        if not source.exists():
            continue
        with Image.open(source) as im:
            largeur, hauteur = im.size
        lignes = [l for l in (ligne(a, largeur, hauteur) for a in annotations) if l]
        if not lignes:
            continue
        part = parts[i]
        stem = Path(noms[i]).stem
        destination = sortie / "images" / part / f"{stem}{source.suffix}"
        try:
            os.symlink(source.resolve(), destination)
        except OSError:
            shutil.copy(source, destination)
        (sortie / "labels" / part / f"{stem}.txt").write_text("\n".join(lignes) + "\n")
        compte[part] += 1
        compte["animaux"] += len(lignes)

    (sortie / "data.yaml").write_text(
        f"path: {sortie.resolve()}\ntrain: images/train\nval: images/val\n"
        f"kpt_shape: [{len(NOMS_POINTS)}, 3]\nflip_idx: {FLIP_IDX}\n"
        f"names:\n" + "".join(f"  {k}: {n}\n" for k, n in enumerate(CLASSES)))
    return compte


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    part_val = float(sys.argv[3]) if len(sys.argv) > 3 else 0.1
    print(preparer(sys.argv[1], sys.argv[2], part_val))
