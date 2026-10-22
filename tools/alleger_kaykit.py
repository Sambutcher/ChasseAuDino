#!/usr/bin/env python3
"""Allège les personnages KayKit (CC0, Kay Lousberg) pour le jeu : ne garde que quelques
animations et un seul équipement, puis reconstruit le .glb sans les données devenues inutiles.

Usage : python3 tools/alleger_kaykit.py <dossier des .glb KayKit> [dossier de sortie]
Sources : github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 et
…-Skeletons-1.0 (addons/…/Characters/gltf/*.glb). Sortie par défaut : models/creatures/.
"""
import json
import struct
import sys
from pathlib import Path

# Nom du jeu → (fichier KayKit, objets à retirer).
PERSONNAGES = {
    "chevalier": ("Knight", ["1H_Sword_Offhand", "Badge_Shield", "Rectangle_Shield", "Spike_Shield", "2H_Sword"]),
    "barbare": ("Barbarian", ["1H_Axe_Offhand", "Barbarian_Round_Shield", "2H_Axe"]),
    "mage": ("Mage", ["Spellbook", "Spellbook_open", "1H_Wand"]),
    "voleur": ("Rogue", ["1H_Crossbow", "2H_Crossbow", "Throwable"]),
    "voleur-capuche": ("Rogue_Hooded", ["1H_Crossbow", "2H_Crossbow", "Throwable"]),
    "squelette-mage": ("Skeleton_Mage", []),
    "squelette-guerrier": ("Skeleton_Warrior", []),
    "squelette-voleur": ("Skeleton_Rogue", []),
}
ANIMATIONS = {"Idle", "Cheer", "Jump_Full_Short", "Running_A", "Taunt", "1H_Melee_Attack_Chop", "Spellcast_Shoot"}


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


def alleger(j, binaire, a_retirer):
    # 1. Animations et objets retirés.
    j["animations"] = [a for a in j.get("animations", []) if a["name"] in ANIMATIONS]
    for nd in j["nodes"]:
        if nd.get("name") in a_retirer:
            nd.pop("mesh", None)
            nd.pop("skin", None)

    # 2. Maillages encore utilisés, renumérotés.
    utilises = sorted({nd["mesh"] for nd in j["nodes"] if "mesh" in nd})
    nouveaux = {old: new for new, old in enumerate(utilises)}
    j["meshes"] = [j["meshes"][i] for i in utilises]
    for nd in j["nodes"]:
        if "mesh" in nd:
            nd["mesh"] = nouveaux[nd["mesh"]]

    # 3. Accesseurs encore utilisés (maillages, peaux, animations), renumérotés.
    acc = set()
    for me in j["meshes"]:
        for p in me["primitives"]:
            acc.update(p["attributes"].values())
            if "indices" in p:
                acc.add(p["indices"])
            for cible in p.get("targets", []):
                acc.update(cible.values())
    for sk in j.get("skins", []):
        if "inverseBindMatrices" in sk:
            acc.add(sk["inverseBindMatrices"])
    for an in j["animations"]:
        for s in an["samplers"]:
            acc.update((s["input"], s["output"]))
    acc = sorted(acc)
    renum_acc = {old: new for new, old in enumerate(acc)}
    j["accessors"] = [j["accessors"][i] for i in acc]
    for me in j["meshes"]:
        for p in me["primitives"]:
            p["attributes"] = {k: renum_acc[v] for k, v in p["attributes"].items()}
            if "indices" in p:
                p["indices"] = renum_acc[p["indices"]]
            p["targets"] = [{k: renum_acc[v] for k, v in c.items()} for c in p.get("targets", [])] or None
            if p["targets"] is None:
                del p["targets"]
    for sk in j.get("skins", []):
        if "inverseBindMatrices" in sk:
            sk["inverseBindMatrices"] = renum_acc[sk["inverseBindMatrices"]]
    for an in j["animations"]:
        for s in an["samplers"]:
            s["input"], s["output"] = renum_acc[s["input"]], renum_acc[s["output"]]

    # 4. Vues de tampon encore utilisées, recopiées à la suite dans un nouveau binaire.
    vues = sorted({a["bufferView"] for a in j["accessors"] if "bufferView" in a}
                  | {im["bufferView"] for im in j.get("images", []) if "bufferView" in im})
    nouveau = bytearray()
    renum_vue = {}
    nouvelles_vues = []
    for i in vues:
        v = dict(j["bufferViews"][i])
        nouveau += b"\0" * (-len(nouveau) % 4)
        debut = v.get("byteOffset", 0)
        v["byteOffset"] = len(nouveau)
        nouveau += binaire[debut:debut + v["byteLength"]]
        renum_vue[i] = len(nouvelles_vues)
        nouvelles_vues.append(v)
    j["bufferViews"] = nouvelles_vues
    for a in j["accessors"]:
        if "bufferView" in a:
            a["bufferView"] = renum_vue[a["bufferView"]]
    for im in j.get("images", []):
        if "bufferView" in im:
            im["bufferView"] = renum_vue[im["bufferView"]]
    j["buffers"] = [{"byteLength": len(nouveau)}]
    return j, bytes(nouveau)


if __name__ == "__main__":
    source = Path(sys.argv[1])
    sortie = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "models/creatures")
    for nom, (fichier, a_retirer) in PERSONNAGES.items():
        j, binaire = lire_glb(source / f"{fichier}.glb")
        j, binaire = alleger(j, binaire, set(a_retirer))
        ecrire_glb(sortie / f"{nom}.glb", j, binaire)
        print(f"{nom}.glb : {len(binaire) // 1024} Ko, animations {sorted(a['name'] for a in j['animations'])}")
