# 🎨 DOCUMENT 06 : Charte UX/UI – Système de Versioning Graphique & Interface de Résolution de Conflits (Visual Merge UI)

**Projet :** Yidik
**Statut :** Spécification révisée (v1.1) - validation utilisateur à planifier (aucune validation formelle n'a été menée pour la v1.0)
**Version :** 1.1.0 (Octobre 2026)
**Rôle Rédacteur :** Product Designer / UX-UI Lead
**Cible :** Équipe Frontend (TanStack / Tauri) & Ingénieurs QA

*Révision 1.1.0 (16/10/2026) : libellés orientés utilisateur (suppression du jargon interne), accessibilité (clavier, annonces lecteurs d'écran, reduced-motion), états manquants de la fusion, isolation des saisies du mode Preview, portée d'annulation explicite.*

---

## 1. Principes Fondamentaux de l'UX "Local-First"

Dans Yidik, l'utilisateur ne doit jamais ressentir de stress lié à sa connectivité. L'interface doit refléter la transparence absolue de l'état de la donnée (sauvegardée en local ou synchronisée).

### 1.1 L'Indicateur de Statut de Synchronisation (Top Bar UI)
Situé au centre de la barre supérieure, un badge d'état persistant indique la situation de la base locale RxDB :
*   **🟢 État : Synchronisé**
    *   *Visuel :* Icône de nuage vert avec coche (icône de l'ensemble d'icônes produit, pas un emoji).
    *   *Texte (au survol et au focus) :* « Tout est enregistré et synchronisé. »
*   **🟡 État : Autonomie Locale**
    *   *Visuel :* Icône de disque dur ambre avec flèche circulaire immobile.
    *   *Texte :* « Hors-ligne : [X] modifications sont enregistrées localement. Envoi automatique dès le retour du réseau. »
*   **🔵 État : Synchronisation en cours**
    *   *Visuel :* Spinner bleu rotatif fluide.
    *   *Texte :* « Envoi des modifications en cours… »
    *   *(v1.0 : « Poussée des deltas JSON vers le serveur central... » - jargon d'implémentation visible utilisateur, remplacé.)*

### 1.2 Accessibilité de l'Indicateur
*   Changement d'état annoncé via une zone `aria-live="polite"` (jamais par la couleur seule - déjà porté par icône + texte).
*   Contraste AA requis sur les trois états (jetons de la charte visuelle).
*   Le libellé au survol est également accessible au focus clavier.

---

## 2. Le Workflow de Versioning Graphique (Git pour les Designers)

Pour éviter la complexité de la ligne de commande Git, le contrôle de version dans Yidik se fait entièrement à travers des interactions visuelles contextuelles.

### 2.1 Le Panneau des Versions (Sidebar Gauche - Onglet "Historique")
Cet onglet remplace l'historique linéaire par un arbre de révisions dynamique :
*   **Bouton Principal :** `[ Créer un Point de Restauration (Commit) ]`
    *   *UX Trigger :* Ouvre une modale centrée demandant un titre (ex: « Refonte du formulaire de paiement ») et une description optionnelle. Le titre devient le message du commit.
*   **Visualisation des Branches :** les branches parallèles s'affichent sous forme de lignes de métro colorées interconnectées. Un clic sur un nœud permet de prévisualiser l'état complet du canevas à cet instant précis sans altérer l'espace de travail actif.

---

## 3. Cinématique de l'Interface de Fusion Visuelle (Visual Merge UI)

Lorsque l'utilisateur repasse en ligne et que le moteur CRDT conserve des écritures concurrentes (registre multi-valeurs, doc 04), le système n'écrase rien. Il fige la zone concernée et alerte l'utilisateur.

### 3.1 Déclenchement de l'Alerte sur le Canvas
*   La Frame ou le composant en conflit est entouré d'un liseré rouge/ambre pointillé (pulsation CSS **avec alternative `prefers-reduced-motion` : halo statique**).
*   Un badge flottant apparaît au-dessus du composant : `⚠️ Conflit de synchronisation avec [Nom du Collaborateur]`.
*   **Action Utilisateur :** un double-clic sur le badge ou sur le bouton « Résoudre » du panneau latéral ouvre le Mode Visual Merge (overlay plein écran).

### 3.2 L'Écran de Fusion à Trois Panneaux (The 3-Pane Merge Table)
Trois espaces de travail verticaux synchronisés en zoom/panoramique (zoomer sur le panneau A zoome B et C au même endroit de manière synchrone) :

*   **Panneau Gauche (A) - « Vos modifications » :** la Frame telle que modifiée localement hors-ligne.
*   **Panneau Central (B) - « Modifications Distantes » :** la version présente sur le serveur cloud.
*   **Panneau Droit (C) - « Résultat Final » :** zone de rendu dynamique, vide au départ, remplie au fil des choix.

#### Flux utilisateur de fusion étape par étape :
1.  **Sélection Globale ou Granulaire :** cliquer sur `[ Choisir cette version ]` en bas du panneau A ou B accepte l'intégralité d'un bloc de modifications d'un coup.
2.  **Sélection Élément par Élément :** cliquer directement sur un composant en conflit (ex: le bouton).
    *   S'il clique sur le bouton vert du panneau A, le bouton passe au vert dans le panneau C.
    *   S'il clique sur l'Input Email du panneau B (absent de sa version locale), l'élément est immédiatement injecté dans le panneau C.
3.  **Validation Finale :** une fois tous les conflits arbitrés, le bouton `[ Appliquer la Fusion ]` devient actif. Un clic exécute un `bulkUpsert` définitif dans RxDB, génère un commit de fusion automatique et pousse le résultat vers le backend.

#### 3.3 Modèle d'Interaction et États (ajout v1.1)
*   **États couverts :** aucun conflit (état vide explicite, pas d'illustration d'erreur), conflits partiellement résolus, **nouveau conflit détecté pendant la fusion** (mise en file et recalcul sans perdre les choix déjà faits), tout résolu → `[ Appliquer la Fusion ]` actif.
*   **Clavier :** navigation inter-panneaux (Tab), sélection d'élément (flèches), choix (Entrée) ; l'ordre de focus suit les conflits restants.
*   **Annonces :** chaque nouveau conflit et chaque résolution sont annoncés via `aria-live`.
*   **Après application :** toast « Fusion appliquée - annulable depuis l'historique ». Le commit de fusion est réversible (doc 04 §4).
*   **Aucun écrasement silencieux :** les valeurs concurrentes non résolues restent visibles.

---

## 4. UX Spécifique aux Éléments de Formulaires Réels en Mode Preview

Le principal atout de Yidik : de vrais formulaires fonctionnels dans le prototype (Web, Desktop, Expo Mobile) au lieu de rectangles inertes.

### 4.1 L'Interrupteur de Mode (Design vs. Live Preview)
Situé dans le coin supérieur droit, un commutateur (Toggle) à deux positions structure l'expérience :
*   **🛠️ Mode Conception (Design) :** les inputs, boutons et listes se comportent comme des objets vectoriels standards - redimensionnement, padding via l'Auto Layout, placeholders, schémas de validation (TanStack Form). Un clic à l'intérieur ne donne pas le focus au texte, mais sélectionne le calque.
*   **⚡ Mode Preview Dynamique (Live Play) :** le canvas se fige structurellement mais devient totalement interactif - saisie, cases, menus déroulants, boutons déclenchant des actions logiques locales simulées. L'IA locale connectée via MCP peut analyser ce comportement de test pour ajuster le code généré (avec consentement explicite, cf. doc 05 §1).

### 4.2 Isolation des Données de Test (ajout v1.1)
*   Les saisies et actions du mode Preview s'exécutent dans un **bac à sable jetable** : jamais écrites dans les données du projet.
*   À la sortie du mode Preview : « Réinitialiser le bac à sable » (par défaut) ou « Capturer comme exemple » (phase 2).
*   Les appels « simulés » à RxDB en Preview écrivent dans des collections de démonstration éphémères.
