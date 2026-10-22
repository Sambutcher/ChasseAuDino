"""Prépare RTMPose pour ONNX Runtime Web (WebAssembly, processeur) : version quantifiée en int8
(poids), comparée à la version float32 sur une photo, avec durées d'inférence.

Usage : python3 web_posture.py rtmpose.onnx image.jpg dossier_sortie
Écrit rtmpose-fp32.onnx, rtmpose-int8.onnx et comparaison.json dans dossier_sortie.
"""
import json
import shutil
import sys
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from onnxruntime.quantization import QuantType, quantize_dynamic
from PIL import Image

MOYENNE = np.array([123.675, 116.28, 103.53], dtype=np.float32)
ECART = np.array([58.395, 57.12, 57.375], dtype=np.float32)
source, image_chemin, sortie = sys.argv[1:4]
sortie = Path(sortie)
sortie.mkdir(exist_ok=True)
fp32 = sortie / "rtmpose-fp32.onnx"
int8 = sortie / "rtmpose-int8.onnx"
shutil.copy(source, fp32)
quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QUInt8)

# Image entière mise au carré par bandes grises, 256×256, NCHW normalisé (comme le jeu).
img = Image.open(image_chemin).convert("RGB")
cote = max(img.size)
carre = Image.new("RGB", (cote, cote), (114, 114, 114))
carre.paste(img, ((cote - img.width) // 2, (cote - img.height) // 2))
x = ((np.asarray(carre.resize((256, 256), Image.BILINEAR), dtype=np.float32) - MOYENNE) / ECART)
nchw = x.transpose(2, 0, 1)[None].copy()


def estimer(chemin):
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1  # comme ORT Web sans multithread
    s = ort.InferenceSession(str(chemin), options, providers=["CPUExecutionProvider"])
    s.run(None, {"input": nchw})
    debut = time.perf_counter()
    for _ in range(5):
        sx, sy = s.run(["simcc_x", "simcc_y"], {"input": nchw})
    ms = (time.perf_counter() - debut) / 5 * 1000
    pts = [(float(np.argmax(a)) / 2, float(np.argmax(b)) / 2, float(min(a.max(), b.max()))) for a, b in zip(sx[0], sy[0])]
    return pts, ms, sorted({n.op_type for n in __import__("onnx").load(str(chemin)).graph.node})


ref, ms32, _ = estimer(fp32)
q, ms8, ops8 = estimer(int8)
ecart = max(max(abs(a[0] - b[0]), abs(a[1] - b[1])) for a, b in zip(ref, q) if a[2] > 0.3)
resultat = {
    "taille_fp32_mo": round(fp32.stat().st_size / 1e6, 1),
    "taille_int8_mo": round(int8.stat().st_size / 1e6, 1),
    "ms_fp32_1thread": round(ms32), "ms_int8_1thread": round(ms8),
    "ecart_max_px": ecart, "operateurs_int8": ops8,
    "points_fp32": [[round(p[0]), round(p[1]), round(p[2], 2)] for p in ref],
    "points_int8": [[round(p[0]), round(p[1]), round(p[2], 2)] for p in q],
}
json.dump(resultat, open(sortie / "comparaison.json", "w"), indent=1)
print(json.dumps({k: v for k, v in resultat.items() if not k.startswith("points")}, indent=1))
