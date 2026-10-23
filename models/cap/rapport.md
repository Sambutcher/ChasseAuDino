# Distillation d'Orient Anything en 8 secteurs d'azimut

- Recadrages étiquetés : 7059 ; confiance du professeur ≥ 0.5 : 7028 (6752 apprentissage, 276 évaluation)
- Apprentissage : 25 époques, 1142 s

Accord avec le professeur (ViT-L détouré) sur les voitures de COCO val2017 :

- **Élève MobileNetV3-Small 128 px** : 70.3% exact, 82.6% à un secteur près
- ViT-L 224 px sans détourage : 73.2% exact, 89.5% à un secteur près
- ViT-S 224 px sans détourage : 54.0% exact, 72.8% à un secteur près
- ViT-S 112 px sans détourage : 44.9% exact, 60.5% à un secteur près

Répartition des secteurs (évaluation) : [81, 22, 20, 14, 84, 11, 18, 26]
