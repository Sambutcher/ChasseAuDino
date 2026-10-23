#!/usr/bin/env bash
# Convertit le modèle de pose entraîné (best.pt, voir tools/entrainer_pose.py) au format
# TensorFlow.js dans models/pose/. Une seule fois : le résultat est commité.
#
# Usage : tools/export_pose.sh [poids] [taille]   (défaut pose/best.pt 256)
set -euo pipefail

POIDS="$(realpath "${1:-pose/best.pt}")"
TAILLE="${2:-256}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT

# ultralytics < 8.4 : les versions suivantes ne savent plus exporter en TF.js.
command -v yolo >/dev/null || pipx install "ultralytics<8.4" \
  --pip-args="--index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple"

cp "$POIDS" "$TRAVAIL/best.pt"
cd "$TRAVAIL"
# Même contournement que tools/export_model.sh (tensorflow-decision-forests casse protobuf).
for essai in 1 2 3; do
  yolo export model=best.pt format=tfjs imgsz="$TAILLE" half=True && break
  [ "$essai" = 3 ] && exit 1
  python3 -m pip uninstall -y tensorflow-decision-forests >/dev/null 2>&1 || true
  SITE="$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')"
  mkdir -p "$SITE/tensorflow_decision_forests"
  touch "$SITE/tensorflow_decision_forests/__init__.py"
done

rm -rf "$RACINE/models/pose"
mkdir -p "$RACINE/models"
cp -r best_web_model "$RACINE/models/pose"
ls -la "$RACINE/models/pose"
echo "Pense à ajouter les fichiers du modèle à FICHIERS dans sw.js."
