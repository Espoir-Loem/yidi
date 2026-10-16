# DOCUMENT DE CADRAGE 08 : PROTOCOLE DES SPIKES — PHASE 0
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.0.0

## 0. Règles communes
*   **Question déclarée à l'avance.** Un spike dont la question est floue est un prototype qui devient un produit.
*   **Code jetable.** Aucun code de spike ne part en production ; la valeur du spike est la réponse écrite, pas le code.
*   **Livrable = note écrite :** question, méthode, mesures brutes, réponse, implication — plus la mise à jour du document de cadrage concerné.
*   **Traçabilité matérielle.** Chaque chiffre indique machine, OS, navigateur/version. Un chiffre sans contexte n'est pas une mesure.
*   **Time-box strict.** Au-delà du temps imparti, on écrit ce qui a été appris et on tranche avec l'information disponible.

## Spike A — Stockage navigateur (time-box : 2 jours)
**Question :** quel moteur de stockage (OPFS / IndexedDB / wa-sqlite sur OPFS) en worker dédié tient une édition interactive, sur Chrome, Firefox, Safari et la WebView Tauri ?
**Contexte :** l'architecture v1.0 (RxDB + OPFS dans un SharedWorker) est irréalisable — les handles synchrones OPFS exigent un worker dédié (MDN ; docs RxDB ; billet PowerSync de mai 2026 ; voir doc 03 §0).
**Méthode :**
1. Harnais : 10 000 documents AST (~1 Ko chacun). Opérations mesurées : insertion par lots de 500, lecture par id, requête simple, mise à jour ciblée, démarrage à froid.
2. Mesurer p50/p95 de latence, débit d'écriture (Mo/s), temps de démarrage, taille disque.
3. Multi-onglets : élection via Web Locks, comportement en collision d'accès.
4. Plateformes : Chrome, Firefox, Safari + WebView2 (Tauri, machine Windows de référence).
**Falsification :** OPFS instable ou indisponible sur une cible majeure → repli IndexedDB documenté ; wa-sqlite nettement plus lent → écarté.
**Seuils :** aucun seuil fixé a priori (la v1.0 citait « 100 Mo/s » sans source). Le spike établit la baseline ; le seuil d'usage est fixé après mesure contre le profil d'édition réel (frappe, déplacement d'éléments).
**Livrable :** tableau de mesures par plateforme + décision motivée, reportée dans doc 03 §1. Les benchmarks publiés par RxDB servent de point de comparaison, écarts de machine annotés.

## Spike B — Sémantique de fusion CRDT (time-box : 1 semaine)
**Question :** le modèle HLC + registres par attribut + MVR (doc 04 §2) se réalise-t-il avec le plugin CRDT de RxDB, et produit-il exactement les conflits que l'UI de fusion (doc 06 §3) doit arbitrer ?
**Méthode :**
1. Mini-scenegraph (~20 nœuds) et scénarios concurrents scriptés :
    a. même attribut modifié sur deux clients ;
    b. suppression d'un côté, modification de l'autre ;
    c. insertion concurrente au même rang d'ordre (index fractionnaire) ;
    d. modifications disjointes (doivent fusionner **sans** conflit).
2. Vérifier : liste des conflits ouverts par nœud/attribut, exportable et exploitable par l'UI ; résolution programmatique d'un conflit → convergence.
3. Test de propriété : rejouer les opérations dans des ordres aléatoires (≥ 100 permutations) → même état final.
4. Si le plugin RxDB montre ses limites : comparer avec Automerge ou Loro sur le même harnais (coût d'intégration RxDB, taille, performance).
**Falsification :** impossible d'obtenir ni MVR par attribut ni liste de conflits exploitable → réduire la granularité de fusion (niveau Frame) et amender docs 04 et 06, ou changer de bibliothèque.
**Livrable :** note + harnais de test conservé + amendements des docs 04/06 si nécessaire.

## Spike C — Renderer 60 fps (time-box : 1 semaine)
**Question :** quel moteur de rendu (Canvas 2D / WebGL type PixiJS / WebGPU) tient 60 fps (budget 16,7 ms/frame) à 5–10 k nœuds pendant pan/zoom continu et édition, sur matériel milieu de gamme ?
**Méthode :**
1. Scène synthétique de 10 000 nœuds (mix frames, texte, inputs de formulaire).
2. Mesures : temps de frame p95 pendant pan/zoom continu, latence de première interaction, temps de recalcul Auto Layout sur une modification en cascade.
3. Cibles : Chrome et WebView2 (Tauri) ; GPU et machine de référence documentés.
**Falsification :** aucun moteur ne tient la cible → réduire la densité (LOD, rendu par étages) ou réviser la promesse 60 fps (PRD §2).
**Livrable :** prototype + traces + recommandation reportée dans doc 03.
