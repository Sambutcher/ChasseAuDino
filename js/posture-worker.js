// Web Worker de posture : RTMPose dans ONNX Runtime Web (WebAssembly, processeur), hors du fil
// principal pour ne pas saccader l'affichage. En WebGL, le modèle saturait la mémoire graphique
// de l'iPhone SE (contextes de TensorFlow et des créatures perdus).
// Messages reçus : { type: 'charger', url } puis { type: 'estimer', id, donnees } (Float32Array
// NCHW 1×3×256×256 normalisé). Réponses : { type: 'pret' }, { type: 'points', id, x, y, n } (sorties
// SimCC, n cases par point) ou { type: 'erreur', id, message }.
import * as ort from '../vendor/onnxruntime/ort.wasm.min.mjs';

ort.env.wasm.numThreads = 1; // le multithread exige des en-têtes COOP/COEP, impossibles sur GitHub Pages
ort.env.wasm.wasmPaths = new URL('../vendor/onnxruntime/', import.meta.url).href;

let session = null;

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'charger') {
      session = await ort.InferenceSession.create(data.url, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      self.postMessage({ type: 'pret' });
    } else if (data.type === 'estimer') {
      const r = await session.run({ input: new ort.Tensor('float32', data.donnees, [1, 3, 256, 256]) });
      const x = r.simcc_x.data;
      const y = r.simcc_y.data;
      self.postMessage({ type: 'points', id: data.id, x, y, n: r.simcc_x.dims[2] }, [x.buffer, y.buffer]);
    }
  } catch (e) {
    self.postMessage({ type: 'erreur', id: data.id, message: String(e?.message || e) });
  }
};
