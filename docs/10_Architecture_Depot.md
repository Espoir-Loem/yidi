# DOCUMENT DE CADRAGE 10 : ARCHITECTURE DU DÉPÔT (MONOREPO PNPM)
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.0.0
*Note de révision 1.0.0 (16/10/2026) : création. Fige les décisions structurantes issues du Spike B (D1-D7), l'arborescence du monorepo, les frontières de dépendances, les contrats de paquets et le pipeline CI. Aucun code produit : la phase 0 reste ouverte (PRD §7).*

## 1. Statut et périmètre
*   **Objet :** définir l'architecture du dépôt - arborescence, paquets, frontières, contrats, outillage, CI - pour que le premier code de la phase 1 s'écrive sans redécision structurelle.
*   **Garde-fou (PRD §7) :** la phase 1 ne démarre pas tant que **A1** (5-8 entretiens, 0/8 à ce jour) et **A3** (Spike A, stockage navigateur) ne sont pas testées. **A4 est vérifiée** depuis le 16/10/2026 (Spike B : fusion par élément réalisable, moteur Automerge - annexe). Le squelette décrit ici ne contient **aucune fonctionnalité produit** et peut exister pendant la phase 0.
*   **Étiquetage des affirmations :** *vérifié* (source primaire), *exécuté* (mesuré - Spike B), *décision* (arbitrage d'architecture). Les versions d'outils de §8 sont vérifiées le 16/10/2026 sur les registres publics (npm, GitHub).
*   **Rapport aux autres documents :** ce document met en œuvre les docs 01-08 ; en cas de contradiction, les documents de cadrage prévalent jusqu'à amendement.

## 2. Décisions structurantes (actées après le Spike B)
| # | Décision | Justification (preuve) |
|---|---|---|
| D1 | **Moteur du document : Automerge 3.5.0** (fusion + conflits) | `getConflicts` expose le registre multi-valeurs exigé par le doc 04 §2 (exécuté : Spike B, convergence 100/100 permutations ; annexe) |
| D2 | **RxDB hors périmètre** | fusion déterministe mais **aucun conflit exposé** (exécuté : Spike B) ; plus aucun rôle une fois Automerge propriétaire du document (doc 03 §0) |
| D3 | **Départage d'ordre `(order, id)`** pour les collisions de rang | l'ordre n'est pas un registre : aucun moteur ne signale la collision (exécuté : Spike B scénario c ; doc 04 §2) |
| D4 | **Suppression vs édition : règle silencieuse** - tombstone applicative (`deleted = true`), la suppression gagne, élément récupérable via l'historique | aucun moteur ne signale le conflit (exécuté : Spike B scénario b ; doc 06 §3.3) |
| D5 | **HLC réservée à l'ordonnancement des commits** | la causalité des attributs est portée par Automerge ; pas d'horloge applicative à maintenir (doc 04 §1-2) |
| D6 | **pnpm workspaces, sans orchestrateur** (ni Turborepo ni Nx) | besoin réel : 5 paquets + 1 app ; KISS ; réévaluer à l'entrée desktop/mobile |
| D7 | **Chaîne d'approvisionnement : versions exactes + lockfile committé + `strictDepBuilds` avec liste `allowBuilds` revue** | pnpm 12 (vérifié, registre npm) : l'installation **échoue** sur tout script de build tiers non revu |

## 3. Arborescence cible
```
yidi/
├── apps/
│   └── web/                      # @yidik/web - SPA Vite + React + TanStack Router (coquille)
├── packages/
│   ├── ast/                      # @yidik/ast - types du Visual AST (zéro dépendance)
│   ├── scene/                    # @yidik/scene - règles d'arbre : ordre (order, id), tombstones
│   ├── sync/                     # @yidik/sync - document Automerge : fusion, conflits, persistance
│   ├── layout/                   # @yidik/layout - coquille du futur moteur Auto Layout (types seuls)
│   └── tokens/                   # @yidik/tokens - coquille du futur système de jetons (types seuls)
├── docs/                         # documents de cadrage 01-10 + annexes/
├── scripts/
│   └── check-boundaries.mjs      # vérification mécanique des frontières de dépendances
├── .github/workflows/ci.yml      # lint, frontières, types, tests, build
├── pnpm-workspace.yaml           # composition du workspace + configuration pnpm 12
├── tsconfig.base.json            # options TypeScript partagées (strict)
├── biome.json                    # lint + format (Biome remplace ESLint/Prettier)
├── package.json                  # scripts racine, devDependencies outillage
└── README.md
```

*   **apps/desktop et apps/mobile n'existent pas encore** (phases 2-3) : les frontières ci-dessous les accueillent sans re-décision.
*   **docs/annexes/** reste une archive datée : les résultats de spikes n'y sont jamais réécrits.

## 4. Frontières et règles de dépendances
*   **Sens des dépendances :** les types (`ast`) ne dépendent de rien ; les règles d'arbre (`scene`) dépendent de `ast` ; l'adaptateur moteur (`sync`) dépend de `scene` ; les apps dépendent des paquets, jamais l'inverse. Une frontière tracée avant le code coûte moins cher qu'une extraction après.
*   **Allowlist (dépendances runtime) :**

| Paquet | Peut dépendre de | Ne peut pas dépendre de |
|---|---|---|
| `@yidik/ast` | (rien) | tout le reste |
| `@yidik/scene` | `@yidik/ast` | DOM, Node, Automerge |
| `@yidik/layout` | `@yidik/ast` | DOM, Node, moteur de rendu |
| `@yidik/tokens` | `@yidik/ast` | DOM, Node |
| `@yidik/sync` | `@yidik/ast`, `@yidik/scene` + `@automerge/automerge` (seule dépendance externe autorisée) | DOM, Node, apps |
| `apps/web` | tous les `@yidik/*` + dépendances UI | - (une app dépend, elle n'est pas dépendue) |

*   **Application mécanique :** `scripts/check-boundaries.mjs` lit les `package.json` du workspace et échoue si (1) une dépendance runtime d'un paquet sort de l'allowlist, (2) un paquet dépend d'une app, (3) une dépendance externe apparaît sans décision. Exécuté en local (`pnpm check:boundaries`) et en CI.
*   **Paquets internes = sources TypeScript :** `"exports": { ".": "./src/index.ts" }` - pas d'étape de build bibliothèque en phase 1 (Vite et `tsc` consomment directement le TS). Imports relatifs sans extension ; dépendances internes en `workspace:*`. Ce choix est révisable si une publication (doc 05, codegen) l'exige.
*   **Neutralité plateforme :** les paquets n'utilisent ni DOM ni API Node (testables sous Node, embarquables dans un worker web ou Tauri) ; les spécificités plateforme restent dans les apps.

## 5. Contrats par paquet (phase 1)
### `@yidik/ast` - types seuls, zéro dépendance
*   `SceneNode` : `{ id, type, parentId, order, deleted?, layout?, style?, props?, state? }` ; `NodeType` : union littérale (`frame`, `text`, `image`, `form_input`, `form_select`, `form_button`, `container`).
*   `SCHEMA_VERSION` : numéro de schéma du document (migrations, doc 02 §1). Le typage fin par variante (union discriminée des `props`) est un chantier phase 1 - le modèle reste celui du FRD (brouillon v0).

### `@yidik/scene` - règles d'arbre pures
*   `childrenOf(nodes, parentId)` : enfants visibles, triés par `compareSiblings`.
*   `compareSiblings(a, b)` : tri déterministe **`(order, id)`** (D3) - signature structurelle `{ order, id }` volontairement minimale.
*   `isVisible(node)` : fausse si tombstone (`deleted = true`, D4).
*   Aucun import d'Automerge : les règles d'arbre restent testables sans le moteur.

### `@yidik/sync` - document Automerge
*   `createSceneDocument()` → `Doc<{ schemaVersion, nodes: Record<id, SceneNode> }>`.
*   `upsertNode(doc, node)` / `removeNode(doc, id)` - `removeNode` pose une **tombstone** (`deleted = true`), ne supprime **jamais** la clé (D4).
*   `mergeScenes(local, remote)` → `Automerge.merge` ; **cloner avant toute bifurcation** (discipline API 3.5, doc 04 §1).
*   `conflictsFor(doc, id, property)` → `getConflicts(doc.nodes[id], property)` - l'entrée de l'UI de merge (doc 06 §3).
*   `saveScene(doc)` / `loadScene(bytes)` : binaire (persistance).
*   Passerelles de synchronisation : `generateSyncMessage` / `receiveSyncMessage` (API 3.5) pour le transport LAN à venir.
*   Tests (Vitest) : scénarios a-d du Spike B + **test de propriété par permutations** (~25 en CI ; campagne 100+ hors CI) - la convergence est un invariant (doc 04 §3), pas une option.

### `@yidik/layout` et `@yidik/tokens` - coquilles
*   Paquets vides (`index.ts` documenté) qui fixent **la frontière avant le code** : le moteur Auto Layout (doc 02 §1) et le jeu de jetons (doc 02 §1, doc 06) s'y logeront en phase 1 sans re-décision de dépendances.

### `@yidik/web` - coquille applicative
*   Vite + React + TanStack Router ; route racine minimale ; importe `@yidik/ast` (types) et `@yidik/scene` (fonction pure) pour **prouver la liaison workspace** (résolution des exports TS par le bundler et `tsc`).
*   Ne câble **rien** de la phase 1 : ni worker de stockage (Spike A), ni document Automerge (WASM), ni transport.

## 6. Données et synchronisation (cible phase 1)
*   **Document :** racine `{ schemaVersion, nodes }` ; un nœud par entrée `nodes[id]` ; enfants déduits par `parentId` + tri `(order, id)` - pas de tableaux d'enfants à maintenir (le reparentage concurrent est hors MVP, doc 04 §3).
*   **Flux local :** mutations → document en mémoire → `save()` → moteur de stockage retenu par le **Spike A** (OPFS / IndexedDB / wa-sqlite), dans un **worker dédié par origine** (doc 03 §1).
*   **Flux réseau :** messages de synchronisation Automerge par WebSocket direct (LAN) - le transport et l'appairage seront spécifiés en phase 1.
*   **Ce que le squelette ne fait pas :** worker de stockage, empaquetage WASM, transport, UI - hors périmètre de ce document.

## 7. Sécurité
*   **Chaîne d'approvisionnement (D7) :** versions **exactes** (pas de `^`/`~`), lockfile committé, `strictDepBuilds` (défaut pnpm 12) + liste `allowBuilds` **revue** - toute entrée signifie « j'ai lu ce que ce script fait à l'installation ». Mise à jour = PR dédiée avec diff du lockfile.
*   **CI :** `permissions: contents: read`, `persist-credentials: false`, aucun secret exposé aux PR.
*   **Produit (rappel des cadres) :** local-first = **aucune requête réseau par défaut** ; le bac à sable Preview ne doit jamais écrire dans le document projet (doc 06 §4.2) - la seule source d'écriture légitime est le document du projet ; l'appairage LAN (TOFU) sera spécifié en phase 1 (doc 03 §3).

## 8. Outillage et versions (vérifiées le 16/10/2026)
| Outil | Version retenue | Note |
|---|---|---|
| pnpm | 12.11.2 | `packageManager` exact ; configuration dans `pnpm-workspace.yaml` (pnpm 12 : `.npmrc` = auth/registre seulement ; `allowBuilds` remplace `onlyBuiltDependencies`) |
| Node.js | `engines: >=24` | CI sur Node 26 (`setup-node@v7`) |
| TypeScript | 7.0.2 | compilateur natif : `baseUrl` non supporté et options historiques allégées - validé empiriquement par le typecheck CI |
| Biome | 2.5.15 | lint + format uniques (pas d'ESLint ni Prettier) |
| Vite | 8.3.4 | dev + build de `apps/web` ; **pair de Vitest 5** (devDependency racine) |
| React | 19.3.1 | apps/web |
| TanStack Router | 1.170.44 | routage de apps/web (API v1 : `createRouter`/`RouterProvider`) |
| Vitest | 5.0.5 | tests `@yidik/sync` (scénarios + propriété) |
| Automerge | 3.5.0 | **unique dépendance runtime externe des paquets** (D1) |
| @vitejs/plugin-react | 6.1.2 | apps/web |
| @types/node | 26.6.5 | outillage/CI uniquement |
| GitHub Actions | `checkout@v7`, `pnpm/action-setup@v6`, `setup-node@v7` | versions majeures vérifiées |
| automerge-repo | **non retenu** (`latest` = 2.6.0-alpha.3) | alpha : pas de dépendance réseau sur un pré-1.0 ; réévaluer en phase 1-2 |

## 9. Intégration continue
Pipeline unique (push/PR vers `main`), ubuntu-latest, `concurrency` avec annulation :

1. `checkout@v7` (`persist-credentials: false`) → 2. `pnpm/action-setup@v6` (12.11.2) → 3. `setup-node@v7` (Node 26, cache pnpm) → 4. `pnpm install --frozen-lockfile` → 5. `pnpm lint` → 6. `pnpm check:boundaries` → 7. `pnpm typecheck` → 8. `pnpm test` → 9. `pnpm build`.

Commandes locales équivalentes :

| Commande | Effet |
|---|---|
| `pnpm install` | installation du workspace (lockfile strict) |
| `pnpm dev` | serveur de dev de `apps/web` |
| `pnpm lint` | Biome (lint + format vérifié) |
| `pnpm check:boundaries` | frontières de §4 |
| `pnpm typecheck` | `tsc --noEmit` sur tout le workspace |
| `pnpm test` | Vitest (paquets qui ont des tests) |
| `pnpm build` | build de `apps/web` |

## 10. Questions ouvertes
| # | Question | Qui / quand |
|---|---|---|
| Q1 | **Spike A non exécuté** : quel moteur de stockage pour le binaire Automerge (OPFS / IndexedDB / wa-sqlite, + WebView Tauri) ? Harnais à reconstruire depuis le commit `8dd5d91`. | phase 0 (gate A3) |
| Q2 | **AN1 : 0/8 entretiens** menés (guide 07) - la douleur hors-ligne est-elle réelle ? | phase 0 (gate A1) |
| Q3 | Génération des clés d'ordre fractionnaire : bibliothèque éprouvée vs implémentation maison (test de propriété associé) | phase 1 |
| Q4 | Empaquetage WASM d'Automerge dans le worker web (Vite + WASM) : premier lot d'intégration | phase 1 |
| Q5 | Transport LAN : WebSocket, découverte (mDNS vs QR), appairage TOFU | phase 1 (spécification sécurité) |
| Q6 | Taille des documents Automerge (tombstones, historique complet) : budget à mesurer | Spikes A/C |
| Q7 | Format du stockage des commits (instantané binaire `save()` par commit) et partitionnement backend | phase 2-3 |

## 11. Dette assumée et hors périmètre
*   `apps/desktop`, `apps/mobile` : absents (phases 2-3) - les frontières les accueillent.
*   Pas d'orchestrateur (D6) : réévaluer si le graphe dépasse ~10 paquets.
*   Pas de publication npm : paquets privés, exports vers sources TypeScript ; réévaluer si le serveur MCP (doc 05) exige des paquets consommables.
*   Pas d'étage de build bibliothèque : le jour où le codegen/MCP consomme `@yidik/*` hors monorepo, introduire un build (tsdown/tsc) sans changer les frontières.
