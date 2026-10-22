// À importer avant GLTFLoader dans les tests Node : juste assez de navigateur pour charger des
// .glb à textures (les images restent vides, inutiles sans rendu).
globalThis.self ??= globalThis;
globalThis.document ??= {
  createElementNS: () => ({
    addEventListener(type, rappel) {
      if (type === 'load') setTimeout(rappel, 0);
    },
    removeEventListener() {},
    set src(_) {},
  }),
};
