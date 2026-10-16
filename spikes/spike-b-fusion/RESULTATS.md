# Spike B - Résultats : la sémantique de fusion du doc 04 (HLC + registres + MVR) se réalise-t-elle ?

**Date d'exécution :** 16 octobre 2026 · **Statut :** harnais exécuté (Node) - décision d'amendement à acter
**Question (rappel, doc 08) :** le modèle HLC + registres par attribut + MVR du doc 04 §2 se réalise-t-il avec le plugin CRDT de RxDB, et produit-il exactement les conflits que l'UI de fusion (doc 06 §3) doit arbitrer ?

**Verdict court.** La fusion est déterministe et converge dans les deux candidats (100/100 permutations d'ordre d'arrivée, scénarios a-d). Mais **le plugin CRDT de RxDB n'expose aucun conflit** : il fusionne automatiquement et l'UI de merge ne dispose d'aucune API pour savoir qu'un arbitrage est nécessaire. **Automerge expose exactement le registre multi-valeurs attendu** (`getConflicts`). La phrase de la documentation RxDB est confirmée par l'expérience - implication directe sur la pile du doc 03 et sur le doc 06.

## 1. Méthode

*   **Montage :** mini-scenegraph de 20 nœuds. Un « serveur » en mémoire (RxDatabase `storage-memory`) exposé aux clients par `rxStorageInstanceToReplicationHandler` - le pattern officiel de la suite de tests RxDB. Deux clients « hors-ligne » divergent puis se synchronisent ; le hors-ligne est simulé par `pause()`/`start()` (en RxDB 17, `live:false` **annule** la réplication après son premier cycle - la synchronisation pilotée exige `live:true`).
*   **Scénarios (doc 08 §Méthode) :** a) même attribut modifié des deux côtés ; b) suppression vs modification ; c) insertion concurrente au même rang d'ordre ; d) modifications disjointes. Plus : résolution programmatique d'un conflit (l'UI choisit) et test de propriété ≥ 100 permutations de l'**ordre d'arrivée** (l'ordre local d'un client est son histoire linéaire : ce que le réseau permute, c'est la séquence d'arrivée/des fusions - pour Automerge, ordre **et multiplicité** des fusions, donc commutativité + associativité + idempotence).
*   **Versions :** rxdb 17.6.0 · @automerge/automerge 3.5.0 · Node v26.7.0 · Windows (win32/x64, 6 cœurs).
*   **Reproduction :** `npm install` puis `npm run rxdb` / `npm run automerge`. Sorties brutes intégrales : `sortie-brute-rxdb.txt`, `sortie-brute-automerge.txt`.
*   **Limites assumées :** stockage mémoire et « serveur » sans réseau - le spike isole la **sémantique de fusion**, pas la performance ni le transport. Rejouer l'opération locale de chaque client est exclu du périmètre (elle est linéaire par construction).

## 2. Constats par scénario

| Scénario | RxDB (plugin CRDT) | Automerge 3.5 |
|---|---|---|
| a. même attribut | convergence (2 tours) ; une valeur gagne, l'autre reste dans le journal `crdts.operations` ; **aucun conflit exposé** | convergence ; `getConflicts` renvoie **les deux valeurs** ; conflit effacé après la résolution |
| b. suppression vs modification | convergence ; `_deleted:true` + `fill:"orange"` fusionnés, document invisible ; **aucun signalement** | nœud **absent** (la suppression l'emporte) ; **aucun conflit signalé** sur la clé ; la modification est inaccessible |
| c. insertion même rang | les deux nœuds conservés, `order` dupliqué ; **aucun signalement** | idem RxDB : les deux nœuds conservés, **aucun conflit d'ordre** |
| d. modifications disjointes | fusion silencieuse des deux (attendu) | fusion silencieuse des deux (attendu) |

Extraits bruts (sorties complètes dans les fichiers de sortie) :

```
SCÉNARIO a - RxDB
   état client A : [{"id":"n01","fill":"vert",...}]
   états identiques : oui (2 tour(s))
   journal CRDT de n01 (client A) :
     rang 1 · creator ahsvwxwc · [{"si":"ifMatch","valeur":{"$set":{"fill":"bleu"}}}]
     rang 1 · creator urtduvph · [{"si":"ifMatch","valeur":{"$set":{"fill":"vert"}}}]
   valeurs concurrentes extractibles par inspection manuelle de fill :
     [{"creator":"sgjmkrkd","valeur":"#2F6FEB"},{"creator":"ahsvwxwc","valeur":"bleu"},{"creator":"urtduvph","valeur":"vert"}]
```

```
SCÉNARIO a - Automerge
   état fusionné : {"id":"n01","fill":"bleu",...}
   getConflicts(n01, fill) → {"4002@414bbd…":"vert","4002@f7a5bc…":"bleu"}
   getConflicts après résolution → aucun
   propagation aux deux clients - A : fill bleu · B : fill bleu · convergents : oui
```

```
SCÉNARIO b - RxDB
   état client A : [{"id":"n05","fill":"orange","size":24,"supprime":true}]
   n05 visible dans les requêtes du client A : non (supprimé)
```

```
SCÉNARIO b - Automerge
   n05 présent dans la carte : non (la suppression l’emporte)
   getConflicts(nodes, n05) → aucun
```

Deux lectures du même résultat : côté RxDB la modification perdante reste **enfouie dans le journal d'opérations** (récupérable seulement en ré-implémentant soi-même la causalité - l'extraction naïve remonte aussi les écritures historiques, pas seulement les concurrentes, comme le montre l'extrait ci-dessus avec 3 valeurs). Côté Automerge la modification du sous-arbre supprimé disparaît de l'API : **pas de registre MVR pour la règle « suppression vs édition »**, dans aucun des deux moteurs.

## 3. Test de propriété (ordre d'arrivée)

| Moteur | Permutations | Convergentes | Durée | Méthode |
|---|---|---|---|---|
| RxDB (plugin CRDT) | 100 | **100/100** | 18,1 s | ordre des clients par tour de sync + nombre de tours (2-6) aléatoires, graine fixe |
| Automerge | 100 | **100/100** | 1,5 s | ordre et multiplicité des fusions (2-6, les deux réplicas toujours présents) aléatoires, graine fixe |

L'état final comparé = champs métier + indicateur de suppression + hash CRDT (RxDB) / représentation complète (Automerge) ; les conflits exposés (Automerge) sont stables entre permutations. Dans les deux moteurs, **l'ordre d'arrivée ne change ni l'état final ni la liste des conflits**.

## 4. Réponse à la question

1. **MVR visible par l'UI :** ❌ avec le plugin CRDT de RxDB - la fusion est automatique et déterministe, aucune API n'expose « valeurs concurrentes par attribut » ; le journal `crdts.operations` permet une lecture artisanale mais elle sur-collecte l'historique et duplique la logique de causalité (HLC/rows) au niveau app. ✅ avec Automerge - `getConflicts(objet, propriété)` renvoie exactement le registre multi-valeurs du doc 04 §2.
2. **Suppression vs modification :** les deux moteurs convergent sans intervention ; la suppression l'emporte pour la visibilité ; **ni l'un ni l'autre ne signale de conflit** (RxDB garde la valeur perdante dans le journal, Automerge ne l'expose plus). Règle silencieuse à acter en tant que telle dans doc 06.
3. **Insertion au même rang :** les deux insertions survivent, `order` est dupliqué, **aucun moteur ne signale quoi que ce soit** - le rang d'ordre n'est pas un registre ; ce cas doit être couvert par une règle d'application (départage déterministe), pas par le moteur. C'est un trou identifié du modèle doc 04.
4. **Modifications disjointes :** fusion silencieuse correcte partout - conforme à l'attendu.
5. **Déterminisme :** validé dans les deux moteurs (100/100) - l'exigence de convergence du doc 04 est réalisable ; elle n'est pas l'endroit où le plugin RxDB pèche.

**Conclusion :** le modèle doc 04 (HLC + registres + MVR) se réalise, mais **pas avec le plugin CRDT de RxDB seul** : ses primitives de fusion sont exactes, son observabilité des conflits est absente. L'exigence d'arbitrage utilisateur du doc 06 §3 est donc infaisable sur cette brique telle quelle.

## 5. Implications et options (décision à acter)

| # | Option | Ce qu'elle implique |
|---|---|---|
| A | **Automerge comme moteur du document scenegraph** (partout, ou comme champ opaque dans RxDB avec gestionnaire de conflits custom côté RxDB) | `getConflicts` alimente directement l'UI de merge ; deux modèles de persistance à tenir (RxDB collections métier + doc AM) ; à cadrer avec le doc 03 (stockage) |
| B | **Interprétation custom du journal d'opérations RxDB** (extraire les ops concurrentes du champ `crdts`) | Pas de nouvelle brique, mais ré-implémentation de la causalité (rows/creators) sur des internes du plugin - dette forte, fragile aux montées de version |
| C | **Réduire l'ambition : auto-merge seul**, pas d'UI de fusion | Contredit le doc 06 §3 ; à acter explicitement si choisie |

Recommandation issue du harnais : **option A** (Automerge expose la primitive exigée et converge) ; l'option B n'est défendable que si l'embarquement d'Automerge échoue au Spike A/C.

## 6. Amendements proposés aux documents de cadrage

*   **Doc 04 §2 :** ajouter la règle de **départage d'ordre total** pour les collisions de rang (tri `(order, id)` déterministe) - constat scénario c, valable pour tous les moteurs ; préciser que « suppression vs édition » est une règle silencieuse (pas un conflit signalé) à assumer côté UX.
*   **Doc 06 §3 :** l'UI d'arbitrage ne peut lire `getConflicts` que si le moteur retenu est Automerge (ou interpréteur custom) ; en l'état RxDB/plugin CRDT, aucun état « conflit ouvert » n'est disponible - l'entrée de l'UI de merge n'existe pas.
*   **Doc 03 :** la réplication pilotée en RxDB 17 exige `live:true` + `pause()/start()` (`live:false` s'auto-annule après le premier cycle) - à retenir pour l'implémentation ; `rxStorageInstanceToReplicationHandler` est la voie officielle pour un backend mémoire/test.

Ces amendements ne sont pas appliqués ici : ils attendent la décision d'architecture qui suit ce spike.

## 7. Notes d'implémentation et traçabilité

*   **Compat API :** Automerge 3.5 consomme les documents passés à `change()`/`merge()` (cloner avant de bifurquer ou de réutiliser) ; `getConflicts` exige `(conteneur, propriété)`, pas un chemin.
*   **Installation :** `npm install` a émis des avertissements de dépréciation transitive de rxdb (dont `crypto-js`, `defekt`) - à intégrer à l'audit dépendances du projet, sans impact sur ce spike.
*   **Fichiers :** `rxdb-crdt.js`, `automerge.js` (harnais) · `sortie-brute-rxdb.txt`, `sortie-brute-automerge.txt` (sorties brutes intégrales) · `package.json` (scripts `rxdb`, `automerge`, `tout`).
*   **Commande de vérification :** `npm run tout` - doit reproduire : 4/4 scénarios convergents, 100/100 permutations des deux côtés.
