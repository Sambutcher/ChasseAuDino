#!/usr/bin/env python3
"""Prépare les animaux riggés du pack « Ultimate Animated Animals » de Quaternius (CC0, glTF)
pour le jeu : conversion en .glb, couleurs pastel par matériau, seuls les clips utiles sont
gardés (le jeu les joue avec un AnimationMixer, voir js/creatures.js), tampon recompacté.
Aucune dépendance (bibliothèque standard).

Usage : python3 -I tools/preparer_animaux.py <dossier des .gltf> [sortie]
Chaque <Animal>.gltf produit models/creatures/<nom du jeu>.glb.
"""
import base64
import json
import struct
import sys
from pathlib import Path

# Fichier du pack → (nom du jeu, couleurs sRGB pastel par matériau). Les yeux gardent leur teinte.
ANIMAUX = {
    "ShibaInu": ("shiba", {
        "Main": "#ffc9a3", "Main_Light": "#fff1de", "Black": "#c3a8ee"}),
    "Fox": ("renard", {
        "Main": "#ffb6d3", "Main_Light": "#fff0f6", "Black": "#c9a9f2", "Grey": "#d8c9ff"}),
    "Horse": ("cheval", {
        "Main": "#d9c8ff", "Main_Light": "#f4eeff", "Main_Dark": "#ffb9e1", "Hair": "#9fe6d2",
        "Hooves": "#ffe4a9", "Muzzle": "#ffd1e2"}),
    "Cow": ("vache", {
        "Main": "#bde9d3", "Main_Light": "#fff6e1", "Hooves": "#ffd9a9", "Muzzle": "#ffc3d5",
        "Horns": "#fff1a9"}),
    "Alpaca": ("alpaga", {
        "Main": "#ffe0ee", "Main_Light": "#fffaf1", "Main_Dark": "#b9e1ff", "Hooves": "#dac9ff",
        "Muzzle": "#ffc3d5"}),
}

# Clips gardés (ni attaque ni mort : le jeu ne s'en sert pas).
CLIPS = {"Idle", "Idle_2", "Idle_Headlow", "Eating", "Walk", "Gallop", "Gallop_Jump", "Jump_toIdle", "Jump_ToIdle",
         "Idle_HitReact1"}


def vers_lineaire(hexa):
    def canal(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    # Un peu assombri (×0,88) : sous la lumière du jeu, un pastel très clair brûle vers le blanc.
    return [0.88 * canal(int(hexa[i:i + 2], 16)) for i in (1, 3, 5)] + [1.0]


def lire_gltf(chemin):
    j = json.loads(Path(chemin).read_text())
    uri = j["buffers"][0]["uri"]
    return j, base64.b64decode(uri.split(",", 1)[1])


def ecrire_glb(chemin, j, binaire):
    texte = json.dumps(j, separators=(",", ":")).encode()
    texte += b" " * (-len(texte) % 4)
    binaire += b"\0" * (-len(binaire) % 4)
    total = 12 + 8 + len(texte) + 8 + len(binaire)
    Path(chemin).write_bytes(
        struct.pack("<III", 0x46546C67, 2, total)
        + struct.pack("<I4s", len(texte), b"JSON") + texte
        + struct.pack("<I4s", len(binaire), b"BIN\0") + binaire)


def filtrer_clips(j):
    j["animations"] = [a for a in j.get("animations", []) if a["name"] in CLIPS]
    # Les pistes d'échelle ne servent à rien (os de taille fixe) : on les retire avec leurs échantillonneurs.
    for a in j["animations"]:
        a["channels"] = [c for c in a["channels"] if c["target"]["path"] != "scale"]
        utilises = sorted({c["sampler"] for c in a["channels"]})
        renum = {ancien: nouveau for nouveau, ancien in enumerate(utilises)}
        a["samplers"] = [a["samplers"][i] for i in utilises]
        for c in a["channels"]:
            c["sampler"] = renum[c["sampler"]]


def compacter(j, binaire):
    """Ne garde que les accesseurs encore référencés, avec leurs vues, dans un tampon neuf."""
    utilises = set()
    for m in j["meshes"]:
        for p in m["primitives"]:
            utilises.update(p["attributes"].values())
            if "indices" in p:
                utilises.add(p["indices"])
    for s in j.get("skins", []):
        utilises.add(s["inverseBindMatrices"])
    for a in j["animations"]:
        for ech in a["samplers"]:
            utilises.update((ech["input"], ech["output"]))
    ordre = sorted(utilises)
    renum = {ancien: nouveau for nouveau, ancien in enumerate(ordre)}
    corps, vues, accesseurs = b"", [], []
    for ancien in ordre:
        acc = dict(j["accessors"][ancien])
        vue = j["bufferViews"][acc["bufferView"]]
        debut = vue.get("byteOffset", 0)
        donnees = binaire[debut:debut + vue["byteLength"]]
        nouvelle = {"buffer": 0, "byteOffset": len(corps), "byteLength": len(donnees)}
        if "target" in vue:
            nouvelle["target"] = vue["target"]
        if "byteStride" in vue:
            nouvelle["byteStride"] = vue["byteStride"]
        corps += donnees + b"\0" * (-len(donnees) % 4)
        acc["bufferView"] = len(vues)
        acc["byteOffset"] = acc.get("byteOffset", 0)
        vues.append(nouvelle)
        accesseurs.append(acc)
    for m in j["meshes"]:
        for p in m["primitives"]:
            p["attributes"] = {k: renum[v] for k, v in p["attributes"].items()}
            if "indices" in p:
                p["indices"] = renum[p["indices"]]
    for s in j.get("skins", []):
        s["inverseBindMatrices"] = renum[s["inverseBindMatrices"]]
    for a in j["animations"]:
        for ech in a["samplers"]:
            ech["input"], ech["output"] = renum[ech["input"]], renum[ech["output"]]
    j["accessors"], j["bufferViews"] = accesseurs, vues
    j["buffers"] = [{"byteLength": len(corps)}]
    return corps


def preparer(source, sortie, couleurs):
    j, binaire = lire_gltf(source)
    for mat in j["materials"]:
        if mat.get("name") in couleurs:
            mat["pbrMetallicRoughness"]["baseColorFactor"] = vers_lineaire(couleurs[mat["name"]])
        mat["pbrMetallicRoughness"]["metallicFactor"] = 0.0
        mat["pbrMetallicRoughness"]["roughnessFactor"] = 0.85
    filtrer_clips(j)
    corps = compacter(j, binaire)
    ecrire_glb(sortie, j, corps)
    return [a["name"] for a in j["animations"]], len(corps)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    dossier = Path(sys.argv[1])
    sortie = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "models" / "creatures"
    sortie.mkdir(parents=True, exist_ok=True)
    for fichier, (nom, couleurs) in ANIMAUX.items():
        cible = sortie / f"{nom}.glb"
        clips, octets = preparer(dossier / f"{fichier}.gltf", cible, couleurs)
        print(f"{nom}: {len(clips)} clips, {cible.stat().st_size // 1024} Ko")
