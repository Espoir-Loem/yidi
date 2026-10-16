# Yidik

Éditeur de design d'interface **local-first** : canvas vectoriel hors-ligne, composants de formulaire réels en Preview, versioning graphique avec fusion visuelle, assistance IA locale via MCP.

> **Statut : cadrage v1.1 (octobre 2026) - aucun code. Phase 0 (dérisquage) en cours.**

## Documents de cadrage

| # | Document | Contenu |
|---|---|---|
| 01 | [PRD](docs/01_PRD_Yidik.md) | Problème, personas, concurrence, périmètre phasé, métriques, critères d'arrêt |
| 02 | [FRD](docs/02_FRD_Composants_Reels.md) | Visual AST (brouillon), composants formulaires, canvas interactif |
| 03 | [DAT](docs/03_DAT_Architecture_Backend_Solid.md) | Architecture Web / Desktop / Mobile / Backend |
| 04 | [CRDT](docs/04_Protocole_Synchronisation_CRDT.md) | Réplication RxDB, HLC + registres multi-valeurs, invariants |
| 05 | [MCP & Codegen](docs/05_Infrastructure_IA_MCP_Codegen.md) | Serveur MCP local (sécurisé), pipeline de traduction en code |
| 06 | [Charte UX](docs/06_Charte_UX_Visual_Merge.md) | Statut de synchronisation, versioning, Visual Merge UI |
| 07 | [Guide d'entretiens](docs/07_Guide_Entretiens_Phase0.md) | Recrutement, déroulé, synthèse - valide les hypothèses A1/A2 |
| 08 | [Protocole des spikes](docs/08_Protocole_Spikes_Phase0.md) | Spikes A (stockage), B (fusion CRDT), C (renderer 60 fps) |
| 09 | [Modèle de synthèse entretiens](docs/09_Synthese_Entretiens_Modele.md) | Structure de dépouillement : campagne, participants, registre des constats, verdicts A1/A2, décision |

## Harnais Phase 0

| Harnais | État |
|---|---|
| Spike A - stockage navigateur | harnais retiré du dépôt (récupérable dans l'historique git, commit `8dd5d91`) ; à reconstruire et exécuter sur Chrome, Firefox, Safari et WebView2 (une entrée de mesures par plateforme) |
| Spike B - fusion CRDT | exécuté le 16/10/2026 sous Node ; décision actée (moteur Automerge) ; résultats archivés dans [docs/annexes/2026-10-16_SpikeB_Resultats.md](docs/annexes/2026-10-16_SpikeB_Resultats.md) |
| Spike C - renderer 60 fps | à construire si A/B concluants |

## Questions à trancher avant d'écrire du code produit (Phase 0)

1. **La douleur existe-t-elle ?** → guide 07, hypothèses A1/A2 du PRD §7
2. **Quel stockage navigateur ?** → spike A : OPFS exige un worker dédié, pas un SharedWorker (constat doc 03 §0)
3. **La fusion par élément est-elle réalisable ?** → spike B exécuté (16/10/2026) : convergence déterministe 100/100 ; décision actée, moteur Automerge (`getConflicts`) - [résultats archivés](docs/annexes/2026-10-16_SpikeB_Resultats.md)
4. **Le 60 fps tient-il ?** → spike C : 5-10 k nœuds, budget 16,7 ms/frame

## Licence

MIT - voir [LICENSE](LICENSE).
