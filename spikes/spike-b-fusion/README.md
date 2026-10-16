# Spike B - Sémantique de fusion CRDT : le modèle HLC + MVR est-il réalisable ?

**Question (doc 08 §Spike B) :** le modèle HLC + registres par attribut + MVR (doc 04 §2) se réalise-t-il avec le plugin CRDT de RxDB, et produit-il exactement les conflits que l'UI de fusion (doc 06 §3) doit arbitrer ?
**Time-box :** 1 semaine. Ce harnais exécute les scénarios scriptés et le test de propriété (≥ 100 permutations) ; la réponse écrite et les amendements docs 04/06 se consignent dans `RESULTATS.md`.

## Ce que joue le harnais (doc 08 §Méthode)
Mini-scenegraph de ~20 nœuds, deux clients « hors-ligne » qui divergent puis se synchronisent :

| # | Scénario | Attendu doc 04/06 |
|---|---|---|
| a | même attribut modifié sur deux clients | conflit **MVR visible** : les deux valeurs conservées, UI d'arbitrage |
| b | suppression d'un côté, modification de l'autre | règle explicite (doc 06), pas de perte silencieuse sur l'attribut modifié |
| c | insertion concurrente au même rang d'ordre (index fractionnaire) | pas de conflit bloquant ; ordre total déterministe |
| d | modifications disjointes | fusion **sans** conflit signalé |

Plus : liste des conflits ouverts par nœud/attribut (exportable pour l'UI), résolution programmatique d'un conflit → convergence, et test de propriété : rejouer les opérations dans des ordres d'arrivée aléatoires (≥ 100 permutations) → même état final.

## Deux candidats, même harnais
*   `rxdb-crdt.js` - plugin CRDT officiel de RxDB (le pari du doc 03/04). Avertissement déjà relevé dans la doc RxDB : « If you can have cases where user interaction is required to correctly merge conflicting document states, you cannot use CRDTs for that ». Le spike tranche par l'expérience, pas par le slogan.
*   `automerge.js` - Automerge (contre-candidat prévu par le doc 08 §Méthode.4). Expose `getConflicts()` : sémantique multi-valeurs (MVR) explicite.

## Lancer
```
npm install        # rxdb, @automerge/automerge - versions exactes notées dans RESULTATS.md
npm run rxdb       # scénarios a-d + test de propriété sur le plugin RxDB CRDT
npm run automerge  # mêmes scénarios sur Automerge
npm run tout       # les deux
```

La synchronisation entre les deux clients est locale et volontairement simplifiée : un « serveur » en mémoire (`spikes/spike-b-fusion/lib/`), sans réseau, pour isoler la **sémantique de fusion** - seule question du spike. L'ordre d'arrivée des changements est scripté (cycle 1 : A puis B ; cycle 2 : B puis A), sauf pour le test de propriété où il est aléatoire (graine fixe).

## Consigner les résultats
Coller la sortie brute des deux scripts dans `RESULTATS.md` (section « Sorties brutes »), puis rédiger : réponse à la question, écarts constatés vs docs 04/06, décision (garder le modèle / réduire la granularité au niveau Frame / changer de bibliothèque) et amendements nécessaires.

## Dépendances (raison)
*   `rxdb` - pari d'architecture existant du projet (docs 03/04) : le spike doit évaluer *cette* brique, pas une autre.
*   `@automerge/automerge` - contre-candidat nommé dans le protocole (doc 08 §Méthode.4).
*   Aucune autre dépendance : les scénarios sont scriptés à la main pour rester lisibles et jetables (doc 08 §0).
