# DOCUMENT DE CADRAGE 05 : SPÉCIFICATION DE L'INFRASTRUCTURE IA (MCP) ET PIPELINE CODEGEN
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.1.0
*Révision 1.1.0 (16/10/2026) : gouvernance MCP actualisée (Agentic AI Foundation / Linux Foundation), durcissement de la sécurité du serveur MCP local, nuance sur le mapping Flutter/React Native.*

## 1. Serveur MCP Local (Model Context Protocol)
Yidik expose un serveur interne compatible avec MCP sur `http://127.0.0.1:8321` (loopback uniquement). Ce protocole permet à des modèles d'IA comme **Claude Desktop** ou **OpenCode** de lire et manipuler la maquette directement sur la machine de l'utilisateur.
*   **Gouvernance (mise à jour) :** MCP a été créé par Anthropic (2024) puis **donné à l'Agentic AI Foundation (Linux Foundation) le 09/12/2025** — standard neutre, mainteneurs inchangés. Aucune dépendance à un éditeur unique.
*   **Confidentialité :** le serveur MCP lui-même n'envoie aucune donnée de conception vers un serveur tiers ; tout passe par des flux JSON-RPC locaux en loopback.
*   **Sécurité locale (durcissement) :** toute application locale peut se connecter à un port loopback. Exigences :
    *   jeton de session échangé via fichier local à droits restreints ;
    *   `yidik_read_canvas` en lecture par défaut ;
    *   `yidik_mutate_element` **soumise à confirmation utilisateur**, sauf activation explicite d'un « mode confiance » par projet ;
    *   limites de débit et de taille de payload.
*   **Outils exposés (Tools Specification) :**
    *   `yidik_read_canvas` : extrait l'arbre complet des composants graphiques (Visual AST).
    *   `yidik_mutate_element` : permet à l'IA d'ajouter, modifier ou supprimer un composant — avec les garde-fous ci-dessus.

## 2. Pipeline de Traduction en Code Multi-Framework (Codegen Engine)
Yidik stocke ses données sous la forme d'un véritable arbre syntaxique visuel (Visual AST, doc 02) composé d'éléments réels et non de pixels bruts. La traduction vers la cible principale est une transformation déterministe.
*   **Cible principale : React / Tailwind CSS + TanStack Form** — transformation déterministe de l'AST.
*   **Cibles secondaires (phases ultérieures) :** Vue.js 3 / Svelte.
*   **Nuance (correction) :** Flutter et React Native ne sont **pas** des traductions directes du modèle HTML/CSS — ils exigent une étape de **mapping sémantique** (widgets natifs, contraintes de layout). Complexité à ne pas sous-estimer ; hors périmètre MVP.
*   **Référence unique :** l'AST est la source de vérité. L'IA peut ajuster le code produit, mais toute modification structurelle repasse par l'AST (pas de dérive « le code fait foi »).
