# Spikes Phase 0 - harnais d'exécution

Ce dossier contient les **instruments** des spikes décrits dans `docs/08_Protocole_Spikes_Phase0.md`. Chaque harnais produit des mesures brutes ou des constats observables ; la réponse écrite et la décision se consignent ensuite dans le document de cadrage concerné.

| Spike | Dossier | Question | Livrable attendu |
|---|---|---|---|
| A - Stockage navigateur | `spike-a-stockage/` | Quel moteur de stockage (OPFS / IndexedDB) en worker dédié tient une édition interactive, sur Chrome, Firefox, Safari et WebView2 ? | Tableau de mesures par plateforme + décision → doc 03 §1 |
| B - Sémantique de fusion CRDT | `spike-b-fusion/` | Le modèle HLC + registres par attribut + MVR (doc 04 §2) se réalise-t-il, et produit-il exactement les conflits que l'UI de fusion (doc 06 §3) doit arbitrer ? | Note + harnais conservé + amendements docs 04/06 si nécessaire |
| C - Renderer 60 fps | *(à construire si A/B concluants)* | Quel moteur de rendu tient 60 fps à 5-10 k nœuds ? | Prototype + traces → doc 03 |

## Règles (doc 08 §0)
*   Question déclarée à l'avance ; code jetable ; la valeur du spike est la réponse écrite, pas le code.
*   Traçabilité matérielle : chaque chiffre indique machine, OS, navigateur/version. Un chiffre sans contexte n'est pas une mesure.
*   Time-box strict : Spike A = 2 jours, Spike B = 1 semaine.

## État
| Spike | Harnais | Exécution | Résultats consignés |
|---|---|---|---|
| A | prêt (`spike-a-stockage/`) | à exécuter par plateforme (Chrome, Firefox, Safari, WebView2) | `spike-a-stockage/RESULTATS.md` (à créer au dépouillement) |
| B | prêt (`spike-b-fusion/`) | exécuté sous Node (voir `spike-b-fusion/RESULTATS.md`) | `spike-b-fusion/RESULTATS.md` |
