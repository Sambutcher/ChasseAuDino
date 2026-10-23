#!/usr/bin/env python3
"""Entraîne yolo11n-pose sur Animal Pose (chien, chat, mouton, cheval, vache ; 20 points clés) puis
l'exporte en TensorFlow.js pour le jeu. À lancer dans un notebook Kaggle avec GPU.

Dans le notebook (Settings : Accelerator = GPU, Internet = On ; Add Input : le dataset
« bloodaxe/animal-pose-dataset ») :

    !git clone https://github.com/Sambutcher/ChasseAuxBebetes
    !python ChasseAuxBebetes/tools/entrainer_pose.py

Sortie dans /kaggle/working : pose-tfjs.zip (modèle TF.js, à décompresser dans models/pose/ du dépôt),
best.pt (poids PyTorch) et resultats.txt (métriques). Hors Kaggle :
python3 tools/entrainer_pose.py <dossier du dataset> <dossier de travail>
"""
import shutil
import subprocess
import sys
from pathlib import Path

TAILLE = 256  # le jeu envoie au modèle un carré de 256 px découpé autour de l'animal suivi
EPOQUES = 120


def trouver_dataset(racine):
    for chemin in Path(racine).rglob("keypoints.json"):
        return chemin.parent
    sys.exit(f"keypoints.json introuvable sous {racine}")


def main():
    entree = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/kaggle/input")
    travail = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("/kaggle/working")
    travail.mkdir(parents=True, exist_ok=True)

    # ultralytics < 8.4 : les versions suivantes remplacent l'export TF.js par LiteRT.
    try:
        import ultralytics  # noqa: F401
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "ultralytics<8.4"])
    from ultralytics import YOLO

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from preparer_pose import preparer

    dataset = trouver_dataset(entree)
    print("dataset :", dataset, preparer(dataset, travail / "yolo"))

    modele = YOLO("yolo11n-pose.pt")  # poids de départ : pose humaine, tête réinitialisée (20 points, 5 classes)
    modele.train(
        data=str(travail / "yolo" / "data.yaml"), imgsz=TAILLE, epochs=EPOQUES, batch=32, patience=30,
        project=str(travail / "runs"), name="pose", exist_ok=True,
        fliplr=0.5, flipud=0.0, degrees=10.0, scale=0.5, mosaic=1.0,  # flip_idx dans data.yaml
    )
    meilleur = travail / "runs" / "pose" / "weights" / "best.pt"
    shutil.copy(meilleur, travail / "best.pt")
    metriques = YOLO(str(meilleur)).val(data=str(travail / "yolo" / "data.yaml"), imgsz=TAILLE)
    (travail / "resultats.txt").write_text(
        f"boîtes mAP50 {metriques.box.map50:.3f}  mAP50-95 {metriques.box.map:.3f}\n"
        f"points mAP50 {metriques.pose.map50:.3f}  mAP50-95 {metriques.pose.map:.3f}\n")
    print((travail / "resultats.txt").read_text())

    # Export TF.js en float16 (poids ~2x plus petits), entrée carrée 256×256.
    YOLO(str(meilleur)).export(format="tfjs", imgsz=TAILLE, half=True)
    export = next((meilleur.parent).glob("best_web_model"))
    archive = shutil.make_archive(str(travail / "pose-tfjs"), "zip", export)
    print("modèle TF.js :", archive)


if __name__ == "__main__":
    main()
