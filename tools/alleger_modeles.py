#!/usr/bin/env python3
"""Allège les créatures statiques (un seul maillage dense + une texture 2048) pour le jeu :
simplification du maillage (meshoptimizer) et texture réduite, puis écriture d'un .glb compact.
Les modèles n'ont ni squelette ni animation : le jeu les anime en code (js/animation.js).

Dépendances (hors dépôt) : pip install numpy meshoptimizer pillow
Usage : python3 tools/alleger_modeles.py <dossier des téléchargements> [triangles] [texture] [sortie]
Chaque sous-dossier <nom>/model.glb produit models/creatures/<nom du jeu>.glb.
"""
import ctypes
import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
from meshoptimizer import simplifier
from PIL import Image

# La liaison Python ne déclare pas les types de meshopt_simplifyWithAttributes : sans eux, ctypes
# passe target_error en double et plante.
_P = ctypes.POINTER
simplifier.lib.meshopt_simplifyWithAttributes.argtypes = [
    _P(ctypes.c_uint), _P(ctypes.c_uint), ctypes.c_size_t, _P(ctypes.c_float), ctypes.c_size_t, ctypes.c_size_t,
    _P(ctypes.c_float), ctypes.c_size_t, _P(ctypes.c_float), ctypes.c_size_t, _P(ctypes.c_ubyte),
    ctypes.c_size_t, ctypes.c_float, ctypes.c_uint, _P(ctypes.c_float)]
simplifier.lib.meshopt_simplifyWithAttributes.restype = ctypes.c_size_t
simplify_with_attributes = simplifier.simplify_with_attributes

# Dossier de téléchargement → nom du jeu.
CREATURES = {
    "baby-unicorn": "licorne",
    "puppy": "chiot",
    "kitten": "chaton",
    "dragon-hatchling": "dragon",
    "panda-cub": "panda",
}


def lire_glb(chemin):
    b = Path(chemin).read_bytes()
    n = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + n])
    m = struct.unpack("<I", b[20 + n:24 + n])[0]
    return j, b[28 + n:28 + n + m]


def ecrire_glb(chemin, j, binaire):
    texte = json.dumps(j, separators=(",", ":")).encode()
    texte += b" " * (-len(texte) % 4)
    binaire += b"\0" * (-len(binaire) % 4)
    total = 12 + 8 + len(texte) + 8 + len(binaire)
    Path(chemin).write_bytes(
        struct.pack("<III", 0x46546C67, 2, total)
        + struct.pack("<I4s", len(texte), b"JSON") + texte
        + struct.pack("<I4s", len(binaire), b"BIN\0") + binaire)


def lire_accesseur(j, binaire, i, dtype, colonnes):
    vue = j["bufferViews"][j["accessors"][i]["bufferView"]]
    n = j["accessors"][i]["count"]
    a = np.frombuffer(binaire, dtype=dtype, count=n * colonnes, offset=vue["byteOffset"])
    return a.reshape(n, colonnes) if colonnes > 1 else a


def alleger(source, sortie, triangles, cote_texture):
    j, binaire = lire_glb(source)
    prim = j["meshes"][0]["primitives"][0]
    pos = lire_accesseur(j, binaire, prim["attributes"]["POSITION"], np.float32, 3).copy()
    uv = lire_accesseur(j, binaire, prim["attributes"]["TEXCOORD_0"], np.float32, 2).copy()
    nor = lire_accesseur(j, binaire, prim["attributes"]["NORMAL"], np.float32, 3).copy()
    idx = lire_accesseur(j, binaire, prim["indices"], np.uint32, 1).copy()

    # Simplification : la position compte d'abord, puis les coutures de texture et les normales.
    attributs = np.ascontiguousarray(np.hstack([uv, nor]), dtype=np.float32)
    poids = np.array([1.0, 1.0, 0.3, 0.3, 0.3], dtype=np.float32)
    dest = np.zeros(len(idx), dtype=np.uint32)
    erreur = np.zeros(1, dtype=np.float32)
    n = simplify_with_attributes(
        dest, idx, pos, attributs, poids, index_count=len(idx), vertex_count=len(pos),
        vertex_positions_stride=12, vertex_attributes_stride=20, attribute_count=5,
        target_index_count=triangles * 3, target_error=1.0, options=0, result_error=erreur)
    dest = dest[:n]

    # Sommets restants, renumérotés.
    garde, nouvel_idx = np.unique(dest, return_inverse=True)
    pos, uv, nor = pos[garde], uv[garde], nor[garde]
    nouvel_idx = nouvel_idx.astype(np.uint32)

    # Texture réduite en JPEG.
    vue_img = j["bufferViews"][j["images"][0]["bufferView"]]
    img = Image.open(io.BytesIO(binaire[vue_img["byteOffset"]:vue_img["byteOffset"] + vue_img["byteLength"]]))
    img = img.convert("RGB").resize((cote_texture, cote_texture), Image.LANCZOS)
    tampon = io.BytesIO()
    img.save(tampon, "JPEG", quality=85)

    # Nouveau .glb : indices, positions, uv, normales, image.
    morceaux = [
        (nouvel_idx.tobytes(), 34963),
        (pos.astype(np.float32).tobytes(), 34962),
        (uv.astype(np.float32).tobytes(), 34962),
        (nor.astype(np.float32).tobytes(), 34962),
        (tampon.getvalue(), None),
    ]
    vues, corps, decalage = [], b"", 0
    for donnees, cible in morceaux:
        corps += donnees + b"\0" * (-len(donnees) % 4)
        vue = {"buffer": 0, "byteOffset": decalage, "byteLength": len(donnees)}
        if cible:
            vue["target"] = cible
        vues.append(vue)
        decalage = len(corps)
    mini, maxi = pos.min(axis=0).tolist(), pos.max(axis=0).tolist()
    sortie_j = {
        "asset": {"version": "2.0", "generator": "tools/alleger_modeles.py"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{
            "attributes": {"POSITION": 1, "NORMAL": 3, "TEXCOORD_0": 2}, "indices": 0, "mode": 4, "material": 0}]}],
        "materials": [{
            "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0.0, "roughnessFactor": 0.8},
            "doubleSided": True}],
        "textures": [{"sampler": 0, "source": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
        "images": [{"mimeType": "image/jpeg", "bufferView": 4}],
        "accessors": [
            {"bufferView": 0, "componentType": 5125, "count": len(nouvel_idx), "type": "SCALAR"},
            {"bufferView": 1, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": mini, "max": maxi},
            {"bufferView": 2, "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": 3, "componentType": 5126, "count": len(nor), "type": "VEC3"},
        ],
        "bufferViews": vues, "buffers": [{"byteLength": len(corps)}],
    }
    ecrire_glb(sortie, sortie_j, corps)
    return len(nouvel_idx) // 3, len(pos), float(erreur[0])


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    dossier = Path(sys.argv[1])
    triangles = int(sys.argv[2]) if len(sys.argv) > 2 else 8000
    cote = int(sys.argv[3]) if len(sys.argv) > 3 else 512
    sortie = Path(sys.argv[4]) if len(sys.argv) > 4 else Path(__file__).resolve().parent.parent / "models" / "creatures"
    sortie.mkdir(parents=True, exist_ok=True)
    for source, nom in CREATURES.items():
        cible = sortie / f"{nom}.glb"
        t, s, e = alleger(dossier / source / "model.glb", cible, triangles, cote)
        print(f"{nom}: {t} triangles, {s} sommets, erreur {e:.4f}, {cible.stat().st_size // 1024} Ko")
