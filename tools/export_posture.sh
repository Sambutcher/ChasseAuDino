#!/usr/bin/env bash
# Prépare RTMPose-m (posture animale, AP-10K, 17 points clés) pour ONNX Runtime Web (WebAssembly,
# processeur : en WebGL, le modèle saturait la mémoire graphique de l'iPhone SE). Sur GitHub
# Actions : gh workflow run export-posture.yml -R Sambutcher/ChasseAuDino --ref <branche>
# Résultat dans models/rtmpose-onnx/ : version float32, version int8 et comparaison des deux.
set -euxo pipefail

URL=https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-m_simcc-ap10k_pt-aic-coco_210e-256x256-7a041aa1_20230206.zip
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p travail
cd travail

curl -sfLo rtm.zip "$URL"
unzip -qo rtm.zip
cp ./*/rtmpose_onnx/*/end2end.onnx rtmpose-dynamique.onnx
# Taille d'entrée figée (1×3×256×256) et graphe simplifié.
onnxsim rtmpose-dynamique.onnx rtmpose.onnx --overwrite-input-shape input:1,3,256,256

rm -rf "$RACINE/models/rtmpose-onnx"
python3 "$RACINE/tools/web_posture.py" rtmpose.onnx "$RACINE/tools/chien.jpg" "$RACINE/models/rtmpose-onnx"
ls -la "$RACINE/models/rtmpose-onnx"
