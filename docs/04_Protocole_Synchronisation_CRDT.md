# DOCUMENT DE CADRAGE 04 : PROTOCOLE DE SYNCHRONISATION DISTRIBUÉE ET CRDT
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.1.0
*Révision 1.1.0 (16/10/2026) : unification du modèle de conflits avec la charte 06. Le modèle v1.0 (LWW pur « horodatage vectoriel milliseconde ») ne pouvait pas produire les conflits que l'UI de fusion prétend arbitrer. Passage à un registre multi-valeurs + horloge HLC, ordre fractionnaire, tombstones.*

## 1. Pipeline de Réplication Asynchrone RxDB
L'application Yidik ne bloque jamais l'utilisateur. Les modifications graphiques et structurelles sont enregistrées immédiatement dans les collections de la base réactive locale (RxDB).
*   **File d'Attente Locale (Outbox Pattern) :** hors-ligne, les mutations sont empilées dans un store de réplication persistant localement.
*   **Réplication par lots :** dès qu'une connexion stable est détectée, les documents modifiés sont poussés par lots compressés vers le backend Fastify.
*   **Impératif :** le `conflictHandler` par défaut de RxDB jette la branche locale au profit de l'état serveur - inacceptable pour Yidik. Les collections du Scenegraph utilisent le **plugin CRDT opérationnel de RxDB** (chaque écriture devient une opération type `$set`/`$inc`, fusionnée de façon déterministe) ou un op-log embarqué équivalent. Ne jamais activer le plugin CRDT et un `conflictHandler` personnalisé ensemble - les deux sont incompatibles.

## 2. Modèle de Résolution des Conflits (décision structurante)
Objectif : **préserver** les écritures concurrentes pour que la fusion visuelle (doc 06) puisse les arbitrer - pas les résoudre silencieusement.
*   **Horloge : Hybrid Logical Clock (HLC)** par client (temps physique + compteur logique + `clientId`). Donne un ordre total déterministe et résiste au décalage d'horloge entre appareils. *Remplace la formulation v1.0 « horodatage vectoriel unifié au niveau de la milliseconde », qui confondait horloge logique et horloge physique.*
*   **Attributs : chaque attribut est un registre.** Écritures causalement ordonnées ou portant sur des attributs différents → fusion silencieuse. Écritures **concurrentes sur le même attribut** → **registre multi-valeurs (MVR)** : toutes les valeurs concurrentes sont conservées et exposées à l'UI de fusion ; la décision de l'utilisateur écrit une opération qui réduit le registre.
*   **Structure : arbre de nœuds.** Ordre des enfants par **index fractionnaire** (aucune renumérotation en masse) ; suppression par **tombstone**.
*   **Politique suppression vs modification :** la suppression l'emporte (choix explicite) ; l'élément reste récupérable via l'historique des commits.
*   **LWW** est réservé aux données non arbitrables (présence des curseurs, télémétrie locale) - jamais appliqué à un attribut de design.

## 3. Invariants
*   `elementId` immuable.
*   **Convergence :** deux clients ayant appliqué les mêmes opérations produisent le même document et la même liste de conflits ouverts (test de propriété requis avant mise en production).
*   Hors périmètre MVP (à spécifier en phase 2) : reparentage concurrent, fusion de groupes, édition collaborative d'un même champ texte.
*   **GC :** tombstones conservées jusqu'au prochain commit majeur + 30 jours ; compaction de l'op-log à la création d'un commit.

## 4. Interface avec le Versioning Graphique (charte 06)
*   Un commit = snapshot logique + pointeur vers l'op-log.
*   La résolution de conflits (mode Visual Merge) produit un **commit de fusion**, réversible depuis l'historique.
