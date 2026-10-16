# DOCUMENT DE CADRAGE 01 : PRODUCT REQUIREMENT DOCUMENT (PRD)
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.1.0
*Révision 1.1.0 (16/10/2026) : ajout du problème-cadre, de l'analyse concurrentielle vérifiée, des métriques et critères d'arrêt, du phasage ; les hypothèses non validées sont désormais explicitement étiquetées.*

## 1. Problème (hypothèses — aucune preuve collectée à ce jour)
**Qui :** concepteurs produit et product engineers de petites équipes (< 20 personnes) concevant des interfaces applicatives riches en formulaires.
**Situation :** ils maîtrisent dans un outil cloud, souvent en mobilité ou sur des réseaux instables, puis livrent des maquettes que les développeurs ré-implémentent à la main.
**Douleur (hypothèses à vérifier) :**
* dépendance réseau : perte de travail ou friction dès que la connexion tombe ;
* contraintes de confidentialité : données clients sensibles exigeant un fonctionnement hors-ligne ou auto-hébergé ;
* perte de fidélité design → code sur les formulaires (validation, états, placeholders) : ré-implémentation manuelle.
**Preuves :** **aucune** à ce jour (0 entretien, 0 donnée quantifiée). À collecter : 5–8 entretiens portant sur un épisode passé daté — jamais sur une intention.
**Alternative actuelle (la concurrence réelle) :** Figma, Penpot auto-hébergé, pen.dev, Sketch — voir §4.
**Taille :** inconnue, à estimer après les entretiens.
**Non prescriptif :** le problème ci-dessus ne présuppose ni canvas local, ni CRDT, ni MCP.

## 2. Vision et objectifs stratégiques
Yidik est un éditeur de design d'interface local-first et distribué, dont la proposition de valeur repose sur trois piliers :
1. indépendance réseau complète (offline-first réel, pas un mode dégradé) ;
2. éléments d'interface réels et fonctionnels (inputs, selects, buttons avec validation et états) plutôt que des tracés inertes ;
3. assistance IA locale via MCP.
*Correction de cadrage (16/10/2026) : l'IA locale via MCP n'est plus un différenciateur en soi — pen.dev, Penpot et Figma l'exposent déjà. Les différenciateurs à défendre : fidélité fonctionnelle des formulaires en Preview, fusion visuelle intégrée, synchronisation multi-appareils hors-ligne.*

## 3. Utilisateurs et personas (hypothèses non validées)
*   **Product Designer :** conçoit des interfaces haute fidélité sans craindre les coupures réseau, génère des prototypes instantanés et interactifs.
*   **Product Engineer / Développeur :** inspecte et convertit les composants graphiques en code exact, l'arbre de composants (Visual AST) représentant de vrais éléments de formulaire.
*   **AI Coding Agent (Claude, OpenCode) :** se connecte localement au projet via MCP pour comprendre et modifier la maquette sans latence ni requêtes cloud.

## 4. Analyse concurrentielle (vérifiée le 16/10/2026)
| Acteur | Couverture | Écart exploitable pour Yidik |
|---|---|---|
| Figma | Cloud, temps réel, Dev Mode + MCP (seat payant) | Pas d'offline-first ; formulaires non fonctionnels en prototype |
| Penpot (MPL-2.0) | Open source, self-host / air-gapped, MCP server, tokens DTCG | Pas de promesse offline réelle côté client ; preview non fonctionnelle |
| pen.dev (ex-Pencil) | Fichiers `.pen` JSON dans le dépôt, MCP local, design→code, gratuit | Pas de CRDT/merge visuel, pas de sync multi-appareils offline, pas de formulaires fonctionnels |
| Sketch | Local, macOS | Pas multiplateforme, pas de MCP |

**Fait sourcé :** le champ « maquette lisible par un agent via MCP » est déjà occupé fin 2026 ; Yidik ne peut pas s'y positionner seul.

## 5. Périmètre — phasage
*   **Phase 0 — Dérisquage** (spikes, aucun engagement de périmètre) : A) stockage navigateur OPFS vs IndexedDB en worker ; B) sémantique de fusion par élément sur scenegraph CRDT ; C) renderer 60 fps à 5–10 k nœuds.
*   **Phase 1 — MVP démontrable :** canvas vectoriel local, composants formulaires réels + mode Preview, persistance locale, sync LAN mobile ↔ desktop (mono-utilisateur), indicateur de synchronisation.
*   **Phase 2 — Collaboration :** versioning visuel (commits, branches), fusion 3 panneaux, serveur MCP local, codegen React/Tailwind/TanStack Form.
*   **Phase 3 — Écosystème :** cibles Vue/Svelte puis Flutter/RN (mapping sémantique requis, cf. doc 05), Yidik Cloud multi-équipes.
*   **Cut line (ordre de sacrifice) :** cibles codegen secondaires, branches parallèles, filtres/présets, variantes de composants — jamais : instrumentation, sécurité, fiabilité de sync, chemin de rollback.

## 6. Métriques (à instrumenter avant toute lecture)
*   **North star (proposition) :** part des projets actifs hebdomadaires où une maquette Yidik devient du code réutilisé ou est validée en Preview fonctionnel.
*   **Garde-fous :** taux de conflits de sync non résolus (cible : 0 en régime stable), temps médian de résolution d'un conflit, sessions sans crash, latence de saisie ≤ 16 ms.
*   **Règle :** chaque métrique reçoit un propriétaire nommé, sinon elle ne bougera pas. La baseline est capturée avant tout déploiement.

## 7. Hypothèses critiques et critères d'arrêt
| # | Hypothèse | Test | Falsification | Échéance |
|---|---|---|---|---|
| A1 | La douleur « hors-ligne » est épisodique et récente chez la cible | 5–8 entretiens | < 4/8 décrivent un épisode daté < 30 jours | avant code |
| A2 | Les formulaires fonctionnels en Preview valent un changement d'outil | entretiens + test prix | aucun budget ni propriétaire cité | avant code |
| A3 | OPFS en worker dédié tient les débits requis (Spike A) | benchmark 3 navigateurs + WebView | débit ou stabilité sous le seuil d'usage | phase 0 |
| A4 | La fusion par élément (doc 06) est réalisable sur le modèle CRDT (Spike B) | prototype | conflits non préservables / non résolvables | phase 0 |
| A5 | 60 fps à 5–10 k nœuds (Spike C) | prototype renderer | < 60 fps sur les cibles | phase 0 |

**Critères d'arrêt :** si A1 échoue → repositionner (piste : fidélité formulaire + ownership des données, sans argumentaire offline). Si A4 échoue → réduire la fusion au niveau Frame, ou déléguer le versioning à Git. Aucune phase 1 ne démarre avec A1 et A3 non testées.
