# DOCUMENT DE CADRAGE 09 : MODÈLE DE SYNTHÈSE DES ENTRETIENS - PHASE 0
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.0.0

**Rôle du document.** Modèle unique de dépouillement pour la campagne d'entretiens décrite dans le guide 07. Dupliquer une copie par campagne : `docs/syntheses/<AAAA-MM>_Entretiens.md`. La méthode, le recrutement et le déroulé sont dans le guide 07 ; ce document ne contient que la structure de saisie et de décision.

**Règles de remplissage.**
*   Chaîne obligatoire : **citation verbatim → observation → constat → implication** (doc 07 §4). Un constat sans citation n'en est pas un.
*   Séparer explicitement observation et interprétation (colonnes distinctes).
*   Chaque constat porte son compteur de participants (« 5/8 ») et, s'il existe, le cas contradictoire.
*   Anonymat : P1…P8 dans tout document du dépôt ; l'annuaire nominatif (si jugé nécessaire) reste hors du dépôt.

## 1. Campagne
| Champ | Valeur |
|---|---|
| Campagne | … |
| Dates (début → fin) | … |
| Participants (n) | … |
| Canal de recrutement | … |
| Ce qui a été dit aux participants (verbatim) | … |
| Exclusions et raisons | … |
| Enregistrements (oui/non, consentement) | … |
| Date de suppression des enregistrements (≤ 90 jours) | … |

## 2. Participants
| # | Profil | Équipe / contexte | Situation pertinente (mobilité, réseaux instables…) | Outil utilisé aujourd'hui | A maîtrisé un écran < 30 j | Date |
|---|---|---|---|---|---|---|
| P1 | … | … | … | … | oui/non | … |
| P2 | … | … | … | … | oui/non | … |

## 3. Fiches entretien (une par participant)
### P1 - <profil>
| Citation verbatim | Observation (fait daté, comportement) | Interprétation (étiquetée comme telle) |
|---|---|---|
| « … » | … | … |

> Rappel (doc 07 §3) : questions interdites aux entretiens - « Trouvez-vous ça frustrant ? », « Utiliseriez-vous… ? », « Combien seriez-vous prêt à payer ? », toute question nommant une fonctionnalité. Si une réponse de ce type apparaît dans les notes, l'étiqueter « réponse polie - non exploitable ».

### P2 - <profil>
| Citation verbatim | Observation | Interprétation |
|---|---|---|
| … | … | … |

## 4. Registre des constats
| # | Constat | Participants (n/N) | Citations | Cas contradictoire | Implication |
|---|---|---|---|---|---|
| C1 | … | …/8 | « … » | … | … |
| C2 | … | …/8 | … | … | … |

## 5. Verdicts A1 / A2
| Hypothèse | Seuil (doc 07 §1) | Résultat mesuré | Verdict | Preuves (constats) |
|---|---|---|---|---|
| A1 - douleur hors-ligne épisodique et récente | < 4/8 épisodes datés < 30 j → falsifiée | …/8 épisodes datés | validée / falsifiée / indécise | C… |
| A2 - les formulaires fonctionnels valent un changement d'outil | aucun coût cité spontanément, aucun budget/propriétaire évoqué → falsifiée | … | validée / falsifiée / indécise | C… |

## 6. Décision et suites
| Champ | Valeur |
|---|---|
| Décision | poursuivre / repositionner / arrêter (critères du PRD §7) |
| Fondement | constats C… (avec citations) |
| Si poursuite : mises à jour | PRD §1 (preuves) et §7 (verdicts A1/A2) - date : … |
| Si arrêt : déclenchement du critère d'arrêt | consigner l'hypothèse falsifiée et les constats déclencheurs dans le PRD §7 |
| Décideur | … |
