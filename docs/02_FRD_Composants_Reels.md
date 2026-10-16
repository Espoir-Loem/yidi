# DOCUMENT DE CADRAGE 02 : FUNCTIONAL REQUIREMENTS DOCUMENT (FRD)
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.2.0
*Révision 1.2.0 (16/10/2026) : alignement sur le Spike B - le schéma du Visual AST est versionné au niveau du document Automerge (types du paquet `@yidik/ast`, doc 10) ; plus de référence aux collections RxDB.*
*Révision 1.1.0 (16/10/2026) : correction de l'attribution « Auto Layout TanStack » (TanStack n'expose aucun moteur de mise en page), ajout du brouillon de modèle de données Visual AST, clarification de l'isolation des saisies en Preview.*

## 1. Visual AST - modèle de données minimal (brouillon v0, à valider par spike)
Unité de base : le nœud. Types minimaux du MVP : `frame`, `text`, `image`, `form_input`, `form_select`, `form_button`, `container`.

```json
{
  "id": "el_8f3a",
  "type": "form_input",
  "parentId": "el_1c2b",
  "order": "a3V",
  "layout": { "display": "flex", "direction": "column", "gap": 8, "padding": [12, 12, 12, 12] },
  "style": { "bg": "surface.raised", "fg": "text.primary" },
  "props": { "inputType": "email", "placeholder": "nom@entreprise.com", "required": true, "validation": { "regex": "..." } },
  "state": { "disabled": false, "loading": false }
}
```

Règles :
*   `id` immuable (voir protocole CRDT, doc 04) ; `order` = index fractionnaire, jamais de renumérotation en masse.
*   `style` référence des **jetons uniquement** - aucune valeur hexadécimale brute dans le document.
*   Le **moteur d'Auto Layout est interne au projet** (équivalent Flexbox/Grid inspiré de Yoga). *Correction : la v1.0 attribuait l'Auto Layout à « TanStack » - vérification faite, aucune bibliothèque TanStack ne fournit de moteur de mise en page.*
*   Schéma versionné avec migrations - la version de schéma est portée par le document Automerge (doc 04 §1) ; les types du modèle vivent dans le paquet `@yidik/ast` (doc 10).

## 2. Spécification des éléments d'interface réels (Interactive Canvas)
Yidik sépare chaque élément graphique en deux états exclusifs contrôlés par le moteur de rendu :
*   **Mode Design (Conception) :** les composants sont manipulés via le Scenegraph vectoriel. Le designer modifie le style (jetons → Tailwind CSS à la compilation), la géométrie (Auto Layout interne) et les contraintes.
*   **Mode Preview (Prototype Réel) :** l'arbre de composants instancie des formulaires réels gérés par *TanStack Form* (stable mi-2026). L'utilisateur peut interagir, saisir du texte, cliquer, et valider des états métier avec une fidélité de 100 %. **Les saisies de test sont isolées dans un bac à sable jetable - jamais écrites dans les données du projet (voir charte 06 §4.2).**

## 3. Composants formulaires - spécification
Chaque élément de type formulaire encapsule ses métadonnées d'interaction :
*   `form_input` : types (Text, Password, Number, Email), placeholder, regex de validation, champ requis, état désactivé, message d'erreur associé.
*   `form_select` : liste d'options (statique en MVP ; dynamique en phase 2), option par défaut, désactivation conditionnelle.
*   `form_button` : action (Submit, Reset, Navigation), état de chargement, état désactivé.
*   **Chaque composant définit ses 8 états** (défaut, survol, actif, focus, désactivé, chargement, erreur, vide) en Mode Design *et* en Mode Preview. La matrice d'états complète reste à produire - livrable manquant identifié lors de la revue du 16/10/2026.

## 4. Hors périmètre (assumé, phases ultérieures)
Composants non-formulaires avancés (tableaux, graphiques, texte riche), listes dynamiques alimentées par des données réelles, formulaires multi-étapes - hors MVP.
