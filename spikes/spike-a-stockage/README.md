# Spike A - Stockage navigateur : OPFS vs IndexedDB en worker dédié

**Question (doc 08 §Spike A) :** quel moteur de stockage (OPFS / IndexedDB / wa-sqlite sur OPFS) en worker dédié tient une édition interactive, sur Chrome, Firefox, Safari et la WebView Tauri ?
**Time-box :** 2 jours. **Ce harnais couvre OPFS (handles synchrones en worker dédié) et IndexedDB.** L'option wa-sqlite ne se tranche qu'après ces mesures, et seulement si OPFS primitives est insuffisant (doc 08 §Falsification).

## Ce que mesure le harnais
10 000 documents AST-like (~1 Ko chacun, JSON paddé à taille fixe 1024 octets) dans un **worker dédié**, puis les opérations du protocole :

| Opération | Détail |
|---|---|
| Démarrage à froid | ouverture (répertoire → fichier → handle / base IDB) + première lecture, en ms |
| Insertion par lots | 500 documents, une écriture de 512 Ko (OPFS) / une transaction (IDB) |
| Lecture par id | 1 000 lectures aléatoires, p50/p95 par lecture |
| Mise à jour ciblée | 500 lecture-modification-écriture, p50/p95 |
| Requête simple | 20 « requêtes » sans index (balayage + filtre sur un attribut) - c'est le pire cas assumé, pas un moteur de requêtes |
| Balayage séquentiel | lecture intégrale brute (débit séquentiel) |
| Taille disque | delta de `navigator.storage.estimate()` avant/après préparation + taille du fichier OPFS |

Les **mêmes identifiants et les mêmes requêtes** sont rejoués sur les deux backends (graine fixe) : les chiffres sont comparables entre OPFS et IndexedDB.

## Comment lancer
OPFS exige un **contexte sécurisé** : servir la page sur `localhost` (le `file://` est refusé par certains navigateurs). Depuis ce dossier :

```
npx --yes serve .
# ou, sans Node :  python -m http.server 8080
```

Puis ouvrir l'URL affichée (ex. `http://localhost:3000`) dans chaque navigateur de la matrice.

1. Renseigner « Étiquette machine » (ex. `Windows-11 / i7-1165G7 / 16 Go`).
2. « Tout lancer » (prépare les 2 backends puis mesure OPFS puis IndexedDB).
3. Copier le JSON exporté et l'insérer dans `RESULTATS.md`, une entrée par plateforme.

**WebView2 (Tauri)** : ouvrir la même URL dans une WebView2 de référence - mini-application Tauri (`webviewContentUrl` sur l'URL locale) ou l'outil de test WebView2. Relever la version du WebView2 Runtime dans l'entrée de résultats. Edge n'est pas une WebView2.

## Matrice de campagne (une entrée de résultats par ligne)
| Plateforme | Version | Machine/OS | Fait |
|---|---|---|---|
| Chrome (desktop) | … | Windows de référence | ☐ |
| Firefox (desktop) | … | Windows de référence | ☐ |
| Safari (desktop) | … | macOS | ☐ |
| WebView2 (Tauri) | Runtime … | Windows de référence | ☐ |

**Note Safari.** FileSystemSyncAccessHandle pour OPFS est implémenté côté WebKit, mais la table caniuse grand public est restée confuse sur ce point (issue Fyrd/caniuse #6615). Le harnais fait une **détection de capacité** et affiche « indisponible » plutôt que de planter : l'observation réelle fait foi, relevez la version exacte de Safari dans les résultats.

## Test multi-onglets (doc 08 §Méthode.3)
1. Ouvrir la même page dans **deux onglets** du même navigateur.
2. Lancer « Tout lancer » dans le premier, puis immédiatement dans le second.
3. Observer et consigner :
   * OPFS : le harnais prend un verrou **Web Locks** (`yidik-spike-a-opfs`, exclusif) avant toute ouverture - le second onglet doit **attendre** puis s'exécuter, sans erreur. Si un handle est pris sans verrou (autre origine du code), l'ouverture échoue proprement et l'erreur est affichée.
   * IndexedDB : pas de verrou posé - les deux onglets s'exécutent en parallèle ; consigner le ralentissement éventuel (contention) et l'absence ou non de corruption.
4. Consigner le comportement exact (qui a attendu, combien de temps, messages).

## Limites assumées
* Mesure les **primitives de stockage**, pas la pile RxDB complète (l'overhead du plugin et du worker applicatif se mesure ensuite, une fois le moteur choisi).
* Les « requêtes » sont des balayages sans index : c'est la baseline basse ; un index applicatif (colonne triée, fichier secondaire) améliorera le cas réel.
* La taille disque IDB n'est qu'une estimation par origine (delta avant/après préparation) ; sur une origine vierge, utiliser « Réinitialiser » puis préparer un backend à la fois.
* Machine, OS et version de navigateur doivent figurer dans chaque entrée de résultats - un chiffre sans contexte n'est pas une mesure (doc 08 §0).

## Après la campagne
Consigner dans `RESULTATS.md` (créé au dépouillement) : le tableau par plateforme, les écarts annotés contre les benchmarks publics RxDB, la réponse à la question, la décision (reportée dans doc 03 §1) et les amendements éventuels (repli IndexedDB si OPFS instable sur une cible majeure).
