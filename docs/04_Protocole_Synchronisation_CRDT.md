# DOCUMENT DE CADRAGE 04 : PROTOCOLE DE SYNCHRONISATION DISTRIBUÉE ET CRDT
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.2.0
*Révision 1.2.0 (16/10/2026) : acte le Spike B - le moteur de fusion est **Automerge 3.5** (`getConflicts` expose le registre multi-valeurs) ; le plugin CRDT de RxDB est écarté (aucun conflit exposé). Départage d'ordre total `(order, id)` pour les collisions de rang ; « suppression vs édition » confirmée comme règle silencieuse (docs 06 §3.3, annexe Spike B).*
*Révision 1.1.0 (16/10/2026) : unification du modèle de conflits avec la charte 06. Le modèle v1.0 (LWW pur « horodatage vectoriel milliseconde ») ne pouvait pas produire les conflits que l'UI de fusion prétend arbitrer. Passage à un registre multi-valeurs + horloge HLC, ordre fractionnaire, tombstones.*

## 1. Pipeline de Réplication Asynchrone (Automerge)
L'application Yidik ne bloque jamais l'utilisateur. Les modifications graphiques et structurelles sont appliquées immédiatement au **document Automerge local** (scenegraph).
*   **File d'attente implicite :** hors-ligne, les modifications s'accumulent dans le document local - aucune file applicative (type outbox) à maintenir.
*   **Synchronisation par messages :** au retour du réseau, le **protocole de synchronisation d'Automerge** (`generateSyncMessage` / `receiveSyncMessage`) échange les opérations manquantes entre pairs - en phase 1, en direct par WebSocket sur le réseau local ; au-delà du LAN, vers le backend Fastify.
*   **Pourquoi Automerge (décision Spike B, 16/10/2026) :** le plugin CRDT de RxDB fusionne de façon déterministe mais **n'expose aucun conflit** ; `getConflicts` fournit le registre multi-valeurs du §2 et alimente l'UI de merge (doc 06 §3). **RxDB est écarté du périmètre.** Résultats : `docs/annexes/2026-10-16_SpikeB_Resultats.md`.
*   **Discipline API :** `change()` et `merge()` consomment le document passé - **cloner avant toute bifurcation** (`A.clone`) ; persistance par `save()` / `load()` (binaire).

## 2. Modèle de Résolution des Conflits (décision structurante)
Objectif : **préserver** les écritures concurrentes pour que la fusion visuelle (doc 06) puisse les arbitrer - pas les résoudre silencieusement.
*   **Causalité : portée par Automerge** (identification interne des écritures concurrentes) - aucune horloge applicative à maintenir pour les attributs. La **HLC** reste réservée à l'**ordonnancement des commits** du versioning graphique (doc 06 §2) - jamais appliquée à un attribut de design.
*   **Attributs : chaque attribut est un registre.** Écritures causalement ordonnées ou portant sur des attributs différents → fusion silencieuse. Écritures **concurrentes sur le même attribut** → **registre multi-valeurs (MVR)** : toutes les valeurs concurrentes sont conservées et exposées à l'UI de fusion via `getConflicts(objet, propriété)` (API vérifiée au Spike B) ; la décision de l'utilisateur écrit une opération qui réduit le registre.
*   **Structure : arbre de nœuds.** Ordre des enfants par **index fractionnaire** (aucune renumérotation en masse) ; une **collision de rang** (deux insertions concurrentes au même rang) est départagée par tri **`(order, id)` déterministe** - l'ordre n'est pas un registre : aucun moteur ne signale la collision (constat Spike B scénario c) ; suppression par **tombstone**.
*   **Politique suppression vs modification :** la suppression l'emporte (choix explicite) et **aucun conflit n'est signalé** par le moteur (constat Spike B scénario b) : **règle silencieuse** assumée côté UX (doc 06 §3.3) ; l'élément reste récupérable via l'historique des commits.
*   **LWW** est réservé aux données non arbitrables (présence des curseurs, télémétrie locale) - jamais appliqué à un attribut de design.

## 3. Invariants
*   `elementId` immuable.
*   **Convergence :** deux clients ayant appliqué les mêmes opérations produisent le même document et la même liste de conflits ouverts - **test de propriété exécuté au Spike B (100/100 permutations) ; rejoué en échantillon réduit dans la suite de tests du paquet `@yidik/sync` (campagne complète hors CI)**.
*   **Fork/merge :** toute bifurcation locale clone le document au préalable (exigence API Automerge 3.5) ; `load()` produit un document frais, sans fusion implicite avec l'existant.
*   Hors périmètre MVP (à spécifier en phase 2) : reparentage concurrent, fusion de groupes, édition collaborative d'un même champ texte.
*   **GC :** les tombstones sont **nécessaires à la convergence** et ne sont pas purgées au MVP ; le budget de taille du document est établi par mesure (Spikes A/C) ; toute compaction d'historique est reportée en phase 2.

## 4. Interface avec le Versioning Graphique (charte 06)
*   Un commit = **instantané du document (binaire `save()`) + horodatage HLC + message**, ancré dans l'historique.
*   La résolution de conflits (mode Visual Merge) produit un **commit de fusion**, réversible depuis l'historique.
