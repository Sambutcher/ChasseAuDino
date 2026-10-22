#!/usr/bin/env bash
# Convertit RTMPose-m (posture animale, AP-10K, 17 points clés) au format TensorFlow.js dans
# models/rtmpose-ap10k/. Une seule fois, sur GitHub Actions (TensorFlow exige l'AVX, absent du
# PC de dev) : gh workflow run export-posture.yml -R Sambutcher/ChasseAuDino --ref <branche>
set -euo pipefail

URL=https://download.openmmlab.com/mmpose/v1/projects/rtmposev1/onnx_sdk/rtmpose-m_simcc-ap10k_pt-aic-coco_210e-256x256-7a041aa1_20230206.zip
RACINE="$(cd "$(dirname "$0")/.." && pwd)"
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT
cd "$TRAVAIL"

curl -sfLo rtm.zip "$URL"
unzip -q rtm.zip
cp ./*/rtmpose_onnx/*/end2end.onnx rtmpose.onnx

# ONNX (NCHW) → SavedModel (NHWC), lot fixé à 1, noms de sorties conservés (simcc_x, simcc_y).
onnx2tf -i rtmpose.onnx -o saved_model -ois input:1,3,256,256 -osd
# Référence ONNX Runtime ↔ TensorFlow sur la même image, pour le contrôle TF.js qui suit.
python3 "$RACINE/tools/reference_posture.py" rtmpose.onnx saved_model "$RACINE/tools/chien.jpg" reference

# tensorflowjs importe tensorflow_decision_forests sans s'en servir, et celui-ci casse protobuf :
# module vide à la place si l'import échoue (même astuce que tools/export_model.sh).
if ! python3 -c 'import tensorflowjs' 2>/dev/null; then
  python3 -m pip uninstall -y tensorflow-decision-forests >/dev/null 2>&1 || true
  SITE="$(python3 -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')"
  mkdir -p "$SITE/tensorflow_decision_forests"
  touch "$SITE/tensorflow_decision_forests/__init__.py"
fi
tensorflowjs_converter --input_format=tf_saved_model --output_format=tfjs_graph_model \
  --quantize_float16='*' saved_model tfjs

rm -rf "$RACINE/models/rtmpose-ap10k"
mkdir -p "$RACINE/models"
cp -r tfjs "$RACINE/models/rtmpose-ap10k"
cp -r reference "$RACINE/models/rtmpose-reference"
ls -la "$RACINE/models/rtmpose-ap10k"
