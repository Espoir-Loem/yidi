# DOCUMENT DE CADRAGE 07 : GUIDE D'ENTRETIENS UTILISATEURS - PHASE 0
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.0.0

## 1. Objectif
Trancher les hypothèses **A1** (douleur hors-ligne) et **A2** (valeur des formulaires fonctionnels) du PRD §7 avant toute ligne de code produit. Règle centrale : on interroge le **comportement passé**, jamais l'intention future. Le produit et ses concepts (local-first, CRDT, MCP) ne sont jamais nommés pendant l'entretien.

| # | Hypothèse | Falsification | Seuil |
|---|---|---|---|
| A1 | La douleur « hors-ligne » est épisodique et récente chez la cible | < 4/8 participants décrivent un épisode daté de moins de 30 jours où la connectivité a coûté du temps ou du travail | 4/8 |
| A2 | Les formulaires fonctionnels en Preview valent un changement d'outil | Aucun participant ne cite spontanément la ré-implémentation des formulaires comme coût significatif, et aucun budget ni propriétaire d'outil n'est évoqué | - |

## 2. Recrutement
*   **Profil :** product designers et product engineers de petites équipes (< 20 personnes) concevant des interfaces applicatives riches en formulaires, ayant maîtrisé au moins un écran dans les 30 derniers jours.
*   **Par situation, pas par démographie :** mélanger freelance / studio / produit interne ; au moins 3 travaillant régulièrement en mobilité ou sur réseaux instables ; 1 utilisateur d'un outil alternatif (Penpot, Sketch, pen.dev).
*   **Exclusions :** collègues, proches, toute personne ayant déjà vu un document Yidik.
*   **Trace à conserver :** nombre de participants, canal de recrutement, ce qui leur a été dit, exclusions et raisons.

## 3. Déroulé (45–60 min)
| Phase | Durée | Objectif | Exemples de questions |
|---|---|---|---|
| 1. Contexte | 10 min | un épisode précis, daté | « Racontez-moi la dernière fois que vous avez maîtrisé une interface contenant un formulaire. » |
| 2. Douleur | 15 min | quantifier le coût réel | « Qu'est-ce que ça vous a coûté ? » · « Racontez la dernière fois qu'une connexion a lâché pendant une session. » |
| 3. État actuel | 15 min | observer le workaround | « Montrez-moi comment vous faites aujourd'hui. » (écran partagé avec le designer) |
| 4. Alternatives | 10 min | révéler le vrai concurrent | « Qu'avez-vous essayé ? Qui paie vos outils aujourd'hui ? » |
| 5. Clôture | 5 min | budget et décision | « Qui décide d'un changement d'outil dans l'équipe ? » (jamais « paieriez-vous pour… ») |

**Questions interdites :** « Trouvez-vous ça frustrant ? » · « Utiliseriez-vous un outil qui… ? » · « Combien seriez-vous prêt à payer ? » · toute question nommant une fonctionnalité. Elles produisent une réponse polie, pas une donnée.

## 4. Notes et synthèse
*   Chaîne obligatoire : **citation → observation → constat → implication**. Un constat sans citation verbatim n'en est pas un.
*   Chaque constat porte le **compteur de participants** (« 5/8 ») et, s'il existe, le cas contradictoire.
*   Séparer explicitement observation et interprétation.
*   **Sortie :** mise à jour du PRD §1 (preuves) et §7 (résultats A1/A2) - ou déclenchement du critère d'arrêt si l'hypothèse est falsifiée.

## 5. Éthique et données
*   Consentement explicite pour l'enregistrement ; suppression des enregistrements à 90 jours.
*   Anonymisation par défaut : aucun nom ni entreprise sans accord écrit.
*   Les citations ne sortent du dossier que sous forme anonymisée et validée par le participant si demandé.
