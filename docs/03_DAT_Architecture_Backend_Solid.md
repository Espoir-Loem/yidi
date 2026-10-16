# DOCUMENT DE CADRAGE 03 : DOSSIER D'ARCHITECTURE TECHNIQUE GLOBAL (DAT)
**Projet :** Yidik (Alternative Figma Local-First) | **Date :** Octobre 2026 | **Version :** 1.1.0
*Révision 1.1.0 (16/10/2026) : correction majeure de l'architecture de stockage navigateur (OPFS indisponible en SharedWorker — sources vérifiées), suppression des débits non mesurés, précisions mobile et backend.*

## 0. Contraintes constatées (vérifiées le 16/10/2026)
*   **OPFS :** les handles synchrones (`createSyncAccessHandle`) ne sont disponibles que dans les **Web Workers dédiés** — pas dans le thread principal, ni dans un iframe, ni dans un **SharedWorker** (MDN ; documentation RxDB ; billet PowerSync de mai 2026). Safari ne permet pas non plus de créer un worker dédié depuis un SharedWorker.
*   **Conséquence :** l'architecture v1.0 « RxDB/OPFS s'exécutant dans un SharedWorker » était **irréalisable telle que spécifiée**. Elle est remplacée ci-dessous.

## 1. Web App
*   **SPA TanStack** (Router, Query, Form — stables mi-2026).
*   **Stockage :** un **worker dédié unique par origine** héberge RxDB sur OPFS ; élection du worker via **Web Locks** ; les onglets sont des clients passifs communiquant par canal de messages. Repli retenu si contrainte navigateur ou débit insuffisant : **IndexedDB** dans le worker (compatibilité maximale, débit inférieur).
*   **Décision à trancher par le Spike A** (benchmark Chrome / Firefox / Safari + WebView Tauri) : OPFS vs IndexedDB vs wa-sqlite sur OPFS. *Aucun objectif chiffré de débit n'est inscrit au cadrage avant mesure — le débit dépend du matériel, et les « 100 Mo/s » de la v1.0 étaient une affirmation non sourcée.*

## 2. Desktop App
*   **Tauri v2** (stable depuis le 02/10/2024 ; ligne 2.11/2.12 mi-2026), interface React/TanStack.
*   Persistance : SQLite via l'écosystème Tauri (`tauri-plugin-sql`) avec RxDB au-dessus — **montage exact à valider par spike** (la v1.0 présupposait un « plugin natif RxDB SQLite » non vérifié en contexte Tauri).

## 3. Mobile App (Preview Directe)
*   **React Native (Expo, custom dev client obligatoire)** + **Nitro SQLite**. Contrainte documentée par l'éditeur : Expo Go ne peut pas charger ce module natif, le dev build est requis. Alternative par défaut d'Expo à évaluer si le custom client devient un coût : `expo-sqlite`.
*   Sync réseau local : WebSocket direct desktop/web ↔ mobile, sans transit par internet. **Découverte mDNS à spécifier** (ou appairage par QR code) — gap de la v1.0.

## 4. Backend Yidik Cloud (Cloud Sync & Ingestion)
*   **Fastify** (Node.js/TypeScript) — ingestion asynchrone des flux de réplication.
*   **PostgreSQL** — historique permanent des commits. Partitionnement par **hash de `project_id`** ; un partitionnement littéral « un projet = une partition » ne passe pas l'échelle.
*   **Redis** — distribution des deltas temps réel (WebSockets) et file d'ingestion. Pour l'ingestion durable, utiliser **Redis Streams** (acquittements, relecture) : le Pub/Sub seul est fire-and-forget et perd les messages d'un consommateur hors-ligne.

## 5. Décisions ouvertes (Spikes A / B / C)
| # | Question | Tranche |
|---|---|---|
| A | OPFS vs IndexedDB vs wa-sqlite en worker dédié (3 navigateurs + WebView) | moteur de stockage web |
| B | Sémantique de fusion CRDT (doc 04) réalisable sur scenegraph ? | modèle de conflits |
| C | 60 fps @ 5–10 k nœuds avec le moteur de rendu retenu | moteur de rendu |
