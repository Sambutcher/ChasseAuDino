#!/usr/bin/env bash
# Convertit YOLO11n (COCO) au format TensorFlow.js dans models/yolo11n/.
# Une seule fois : le résultat est commité, le jeu n'a pas besoin de Python.
#
# Usage : tools/export_model.sh [hauteur] [largeur]   (multiples de 32, défaut 384 224 = portrait)
set -euo pipefail

HAUTEUR="${1:-384}"
LARGEUR="${2:-224}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT

# ultralytics < 8.4 : les versions suivantes ne savent plus exporter en TF.js.
# PyTorch CPU pour éviter plusieurs Go de CUDA inutiles.
command -v yolo >/dev/null || pipx install "ultralytics<8.4" \
  --pip-args="--index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple"

cd "$TRAVAIL"
# ultralytics installe ses dépendances au fil de l'export (TensorFlow, puis tensorflowjs) et
# échoue tant que Python n'est pas relancé : on réessaie. tensorflow-decision-forests, tiré par
# tensorflowjs, casse protobuf ; tensorflowjs 4.22 ne fait que l'importer sans s'en servir :
# on le remplace par un module vide entre deux essais.
for essai in 1 2 3; do
  yolo export model=yolo11n.pt format=tfjs imgsz="$HAUTEUR,$LARGEUR" && break
  [ "$essai" = 3 ] && exit 1
  python3 -m pip uninstall -y tensorflow-decision-forests >/dev/null 2>&1 || true
  SITE="$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')"
  mkdir -p "$SITE/tensorflow_decision_forests"
  touch "$SITE/tensorflow_decision_forests/__init__.py"
done

rm -rf "$RACINE/models/yolo11n"
mkdir -p "$RACINE/models"
cp -r yolo11n_web_model "$RACINE/models/yolo11n"
ls -la "$RACINE/models/yolo11n"
echo "Pense à mettre à jour la liste du modèle et VERSION dans sw.js."
