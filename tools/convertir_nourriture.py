#!/usr/bin/env python3
"""Convertit les aliments (.gltf + .bin + textures PNG) en .glb compacts pour le jeu : tout est
embarqué, les textures sont réduites en JPEG. Une texture absente est remplacée par la couleur
unie de secours du matériau (COULEURS_SECOURS).

Dépendance (hors dépôt) : pip install pillow
Usage : python3 tools/convertir_nourriture.py <dossier des aliments> [côté de texture] [sortie]
Sortie par défaut : models/creatures/.
"""
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image

# Fichier source → nom du jeu.
ALIMENTS = {
    "burgerall": "burger",
    "croissant": "croissant",
    "eclair": "eclair",
    "friesbowlwithketchupandfrie": "frites",
    "SushisSalmon": "sushi",
}
# Matériau → couleur de secours quand son image manque.
COULEURS_SECOURS = {"burgermeat": [0.36, 0.17, 0.08, 1], "burgercheese": [1.0, 0.76, 0.12, 1]}


def ecrire_glb(chemin, j, binaire):
    texte = json.dumps(j, separators=(",", ":")).encode()
    texte += b" " * (-len(texte) % 4)
    binaire += b"\0" * (-len(binaire) % 4)
    total = 12 + 8 + len(texte) + 8 + len(binaire)
    Path(chemin).write_bytes(
        struct.pack("<III", 0x46546C67, 2, total)
        + struct.pack("<I4s", len(texte), b"JSON") + texte
        + struct.pack("<I4s", len(binaire), b"BIN\0") + binaire)


def convertir(source, sortie, cote):
    dossier = source.parent
    j = json.loads(source.read_text())
    binaire = (dossier / j["buffers"][0]["uri"]).read_bytes()
    binaire += b"\0" * (-len(binaire) % 4)

    # Images présentes, réduites ; les textures dont l'image manque sont retirées des matériaux.
    nouvelles, index = [], {}
    for i, img in enumerate(j.get("images", [])):
        fichier = dossier / img["uri"]
        if not fichier.exists():
            print(f"  texture absente : {img['uri']} (couleur de secours)")
            continue
        tampon = io.BytesIO()
        Image.open(fichier).convert("RGB").resize((cote, cote), Image.LANCZOS).save(tampon, "JPEG", quality=88)
        donnees = tampon.getvalue()
        j["bufferViews"].append({"buffer": 0, "byteOffset": len(binaire), "byteLength": len(donnees)})
        binaire += donnees + b"\0" * (-len(donnees) % 4)
        index[i] = len(nouvelles)
        nouvelles.append({"mimeType": "image/jpeg", "bufferView": len(j["bufferViews"]) - 1})
    textures = []
    reindex = {}
    for t, tex in enumerate(j.get("textures", [])):
        if tex["source"] in index:
            reindex[t] = len(textures)
            textures.append({**tex, "source": index[tex["source"]]})
    for m in j["materials"]:
        pbr = m["pbrMetallicRoughness"]
        pbr.setdefault("metallicFactor", 0.0)
        pbr.setdefault("roughnessFactor", 0.8)
        t = pbr.get("baseColorTexture")
        if t is not None and t["index"] in reindex:
            t["index"] = reindex[t["index"]]
        elif t is not None:
            del pbr["baseColorTexture"]
            pbr["baseColorFactor"] = COULEURS_SECOURS.get(m.get("name"), [0.8, 0.8, 0.8, 1])
    j["images"], j["textures"] = nouvelles, textures
    if not nouvelles:
        del j["images"], j["textures"]
    j["buffers"] = [{"byteLength": len(binaire)}]
    ecrire_glb(sortie, j, binaire)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    dossier = Path(sys.argv[1])
    cote = int(sys.argv[2]) if len(sys.argv) > 2 else 256
    sortie = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(__file__).resolve().parent.parent / "models" / "creatures"
    sortie.mkdir(parents=True, exist_ok=True)
    for fichier, nom in ALIMENTS.items():
        print(nom)
        convertir(dossier / f"{fichier}.gltf", sortie / f"{nom}.glb", cote)
        print(f"  {(sortie / f'{nom}.glb').stat().st_size // 1024} Ko")
