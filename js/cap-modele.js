// Cap d'une voiture avec le modèle d'orientation (MobileNetV3-Small 128 px, export TensorFlow.js).
// Interface : chargerCap(url) puis estimerCap(canvas) → probabilités des 8 secteurs d'azimut.
// Le canvas est la découpe carrée de la voiture (js/cap.js). `tf` est le global de vendor/tf.min.js.
let modele = null;

export async function chargerCap(url) {
  modele = await tf.loadGraphModel(url);
  const [, hauteur, largeur] = modele.inputs[0].shape;
  // Première inférence à vide : compile les shaders WebGL avant la partie.
  tf.tidy(() => modele.execute(tf.zeros([1, hauteur, largeur, 3])));
  return { largeur, hauteur };
}

export async function estimerCap(canvas) {
  const sortie = tf.tidy(() => modele.execute(tf.browser.fromPixels(canvas).toFloat().div(255).expandDims(0)));
  const probas = await sortie.data();
  sortie.dispose();
  return Array.from(probas);
}
