"""Référence de la conversion RTMPose : même entrée dans ONNX Runtime et dans le SavedModel.

Usage : python3 reference_posture.py modele.onnx saved_model image.jpg dossier_sortie
Écrit entree.bin (float32 NHWC 1×256×256×3, déjà normalisée) et reference.json (17 points ONNX),
puis vérifie que le SavedModel donne les mêmes points (à 2 px près).
"""
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import tensorflow as tf
from PIL import Image

MOYENNE = np.array([123.675, 116.28, 103.53], dtype=np.float32)
ECART = np.array([58.395, 57.12, 57.375], dtype=np.float32)
onnx_chemin, saved_chemin, image_chemin, sortie = sys.argv[1:5]
Path(sortie).mkdir(exist_ok=True)

# Image entière, mise au carré par bandes grises, 256×256 (le jeu découpe autour de l'animal).
img = Image.open(image_chemin).convert("RGB")
cote = max(img.size)
carre = Image.new("RGB", (cote, cote), (114, 114, 114))
carre.paste(img, ((cote - img.width) // 2, (cote - img.height) // 2))
x = (np.asarray(carre.resize((256, 256), Image.BILINEAR), dtype=np.float32) - MOYENNE) / ECART
nhwc = x[None]
nhwc.astype("<f4").tofile(f"{sortie}/entree.bin")


def points(sx, sy):
    sx, sy = sx[0], sy[0]
    return [{"x": float(np.argmax(a)) / 2, "y": float(np.argmax(b)) / 2,
             "score": float(min(a.max(), b.max()))} for a, b in zip(sx, sy)]


session = ort.InferenceSession(onnx_chemin)
noms = [o.name for o in session.get_outputs()]
sorties = dict(zip(noms, session.run(None, {"input": nhwc.transpose(0, 3, 1, 2)})))
ref = points(sorties["simcc_x"], sorties["simcc_y"])
json.dump({"sorties": noms, "points": ref}, open(f"{sortie}/reference.json", "w"), indent=1)

modele = tf.saved_model.load(saved_chemin)
f = modele.signatures["serving_default"]
print("signature :", f.structured_input_signature, f.structured_outputs)
r = {k: v.numpy() for k, v in f(**{next(iter(f.structured_input_signature[1])): tf.constant(nhwc)}).items()}
print("sorties TF :", {k: v.shape for k, v in r.items()})
# onnx2tf renomme les sorties (output_0, output_1…) : chacune est associée à la sortie ONNX la
# plus proche numériquement.
proche = lambda ref: min(r, key=lambda k: float(np.abs(r[k] - ref).max()))
nx, ny = proche(sorties["simcc_x"]), proche(sorties["simcc_y"])
print(f"simcc_x = {nx}, simcc_y = {ny}")
assert nx != ny, "sorties TF indiscernables"
tf_points = points(r[nx], r[ny])
ecart = max(max(abs(a["x"] - b["x"]), abs(a["y"] - b["y"])) for a, b in zip(ref, tf_points) if a["score"] > 0.3)
print("points ONNX :", [(round(p["x"]), round(p["y"]), round(p["score"], 2)) for p in ref])
print(f"écart max ONNX ↔ TF : {ecart} px")
assert ecart <= 2, "conversion TF incorrecte"
