// Pose des animaux avec yolo11n-pose (export TensorFlow.js), entraîné sur Animal Pose.
// Interface : chargerPose(url) puis estimerPose(canvas, classe) → détection { x, y, w, h, score,
// points } dans le repère de l'entrée du modèle (carré de 256 px), ou null.
// `tf` est le global chargé par vendor/tf.min.js, déjà configuré par chargerDetecteur.
import { decoderPose } from './posture.js';

let modele = null;

export async function chargerPose(url) {
  modele = await tf.loadGraphModel(url);
  const [, hauteur, largeur] = modele.inputs[0].shape;
  // Première inférence à vide : compile les shaders WebGL avant la partie.
  tf.tidy(() => modele.execute(tf.zeros([1, hauteur, largeur, 3])));
  return { largeur, hauteur };
}

export async function estimerPose(canvas, classe) {
  const sortie = tf.tidy(() => modele.execute(tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0)));
  const [, , n] = sortie.shape;
  const donnees = await sortie.data();
  sortie.dispose();
  return decoderPose(donnees, n, classe);
}
