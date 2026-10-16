/*
 * Spike B - volet RxDB (plugin CRDT officiel) - doc 08 §Spike B.
 *
 * Question : le modèle HLC + registres par attribut + MVR (doc 04 §2) se réalise-t-il
 * avec le plugin CRDT de RxDB, et produit-il exactement les conflits que l'UI de
 * fusion (doc 06 §3) doit arbitrer ?
 *
 * Montage : un « serveur » en mémoire (RxDatabase storage-memory) exposé aux clients via
 * rxStorageInstanceToReplicationHandler - le pattern officiel de la suite de tests RxDB
 * (plugins/test-utils). Deux clients « hors-ligne » divergent puis se synchronisent.
 *
 * Constat d'implémentation (consigné dans RESULTATS.md) : en RxDB 17, `live: false`
 * ANNULE la réplication après son premier cycle (la doc du code : « Non-live replications
 * run once and then automatically get canceled ») - reSync() y est sans effet. Le montage
 * utilise donc `live: true` et simule le hors-ligne par pause()/start() : les écritures
 * faites en pause ne partent pas, le start() déclenche un RESYNC.
 *
 * Choix de méthode : l'ordre local des opérations d'un client est fixe (c'est son histoire
 * linéaire) ; ce que les permutations du test de propriété font varier, c'est l'ordre
 * d'ARRIVÉE entre réplicas (ordre et multiplicité des cycles de synchronisation),
 * c'est-à-dire ce que le réseau peut réellement permuter.
 */

import { createRxDatabase, addRxPlugin, rxStorageInstanceToReplicationHandler } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBcrdtPlugin, getCRDTSchemaPart } from 'rxdb/plugins/crdt';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { createRequire } from 'node:module';
import os from 'node:os';

addRxPlugin(RxDBcrdtPlugin);

const require = createRequire(import.meta.url);
const VERSION_RXDB = require('rxdb/package.json').version;

/* ══════════════════════ utilitaires ══════════════════════ */

const horodatage = () => new Date().toISOString().slice(11, 23);

function stableStringify(valeur) {
  if (Array.isArray(valeur)) return '[' + valeur.map(stableStringify).join(',') + ']';
  if (valeur && typeof valeur === 'object') {
    const cles = Object.keys(valeur).sort();
    return '{' + cles.map((k) => JSON.stringify(k) + ':' + stableStringify(valeur[k])).join(',') + '}';
  }
  return JSON.stringify(valeur);
}

function avecDelai(promesse, ms, etiquette) {
  return Promise.race([
    promesse,
    new Promise((_, rejeter) => setTimeout(() => rejeter(new Error('délai dépassé (' + ms + ' ms) : ' + etiquette)), ms)),
  ]);
}

function mulberry32(graine) {
  let a = graine >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const titre = (s) => console.log('\n══════════════════════════════════════════════════════════════\n' + s + '\n══════════════════════════════════════════════════════════════');
const sousTitre = (s) => console.log('\n── ' + s + ' ──');
const ligne = (s) => console.log('   ' + s);

/* ══════════════════════ schéma et graine ══════════════════════ */

const PALETTE = ['#2F6FEB', '#1F883D', '#D29922', '#CF222E', '#8250DF', '#0550AE', '#953800', '#6E7781'];
const IDS_GRAINE = Array.from({ length: 20 }, (_, i) => 'n' + String(i + 1).padStart(2, '0'));

function noeudGraine(id, index) {
  return {
    id,
    name: 'Noeud ' + id,
    fill: PALETTE[index % PALETTE.length],
    size: 8 + (index % 5) * 4,
    order: 'a' + String(index).padStart(2, '0'),
    text: 'Texte du noeud ' + id + ' (charge utile du formulaire, répétée pour peser). '.repeat(3),
  };
}

// Le champ des opérations CRDT est déclaré DANS le schéma (contrainte du plugin).
const schemaNoeud = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 64 },
    name: { type: 'string' },
    fill: { type: 'string' },
    size: { type: 'number' },
    order: { type: 'string' },
    text: { type: 'string' },
    crdts: getCRDTSchemaPart(),
  },
  required: ['id'],
  crdt: { field: 'crdts' },
};

/* ══════════════════════ montage serveur + deux clients ══════════════════════ */

async function creerBase(nom) {
  const db = await createRxDatabase({
    name: nom,
    storage: getRxStorageMemory(),
    multiInstance: false,
  });
  await db.addCollections({ nodes: { schema: schemaNoeud } });
  return db;
}

async function creerMontage(suffixe, graine = true) {
  const serveur = await creerBase('spike-b-serveur-' + suffixe);
  if (graine) {
    await serveur.nodes.bulkInsert(IDS_GRAINE.map((id, i) => noeudGraine(id, i)));
  }
  const clientA = await creerBase('spike-b-a-' + suffixe);
  const clientB = await creerBase('spike-b-b-' + suffixe);

  const handler = rxStorageInstanceToReplicationHandler(
    serveur.nodes.storageInstance,
    serveur.nodes.conflictHandler,
    serveur.token
  );
  const erreurs = [];
  const creerReplication = (client, etiquette) => {
    const rep = replicateRxCollection({
      collection: client.nodes,
      replicationIdentifier: 'spike-b-sync-' + suffixe + '-' + etiquette,
      live: true,
      retryTime: 1500,
      waitForLeadership: false,
      autoStart: true,
      push: { handler: (rows) => handler.masterWrite(rows) },
      pull: { handler: (point, taille) => handler.masterChangesSince(point, taille), batchSize: 200 },
    });
    rep.error$.subscribe((e) => {
      erreurs.push(e);
      console.error('[erreur réplication ' + etiquette + '] ' + (e && e.code ? e.code : '') + ' ' + String((e && e.message) || e));
    });
    return rep;
  };
  const repA = creerReplication(clientA, 'a');
  const repB = creerReplication(clientB, 'b');
  return { suffixe, serveur, clientA, clientB, repA, repB, erreurs };
}

async function fermerMontage(m) {
  await m.repA.cancel();
  await m.repB.cancel();
  await Promise.all([m.serveur.remove(), m.clientA.remove(), m.clientB.remove()]);
}

/* ══════════════════════ lecture d'état et synchronisation ══════════════════════ */

async function lireDocs(client, ids) {
  const docs = await client.nodes.storageInstance.findDocumentsById(ids, true);
  return docs.sort((a, b) => a.id.localeCompare(b.id));
}

async function etatCanonique(client, ids) {
  const docs = await lireDocs(client, ids);
  const propre = {};
  for (const d of docs) {
    propre[d.id] = {
      id: d.id,
      name: d.name,
      fill: d.fill,
      size: d.size,
      order: d.order,
      text: d.text,
      supprime: !!d._deleted,
      hashCrdt: d.crdts ? d.crdts.hash : null,
    };
  }
  return stableStringify(propre);
}

async function synchroniser(m, { toursMax = 6, ordre = null } = {}) {
  for (let tour = 1; tour <= toursMax; tour++) {
    const ordreTour = ordre ? ordre(tour) : ['a', 'b'];
    for (const cote of ordreTour) {
      (cote === 'a' ? m.repA : m.repB).reSync();
    }
    await avecDelai(Promise.all([m.repA.awaitInSync(), m.repB.awaitInSync()]), 20000, 'awaitInSync (' + m.suffixe + ')');
    const ids = await idsConnus(m);
    const [eA, eB] = await Promise.all([etatCanonique(m.clientA, ids), etatCanonique(m.clientB, ids)]);
    if (eA === eB) return { convergent: true, tours: tour, etat: eA };
  }
  const ids = await idsConnus(m);
  return {
    convergent: false,
    tours: toursMax,
    etatA: await etatCanonique(m.clientA, ids),
    etatB: await etatCanonique(m.clientB, ids),
  };
}

// Tous les ids connus : union serveur + deux clients (évite les faux positifs
// quand un push n'a pas encore atteint le serveur).
async function idsConnus(m) {
  const candidats = Array.from({ length: 40 }, (_, i) => 'n' + String(i + 1).padStart(2, '0'));
  const [srv, a, b] = await Promise.all([
    m.serveur.nodes.storageInstance.findDocumentsById(candidats, true),
    m.clientA.nodes.storageInstance.findDocumentsById(candidats, true),
    m.clientB.nodes.storageInstance.findDocumentsById(candidats, true),
  ]);
  const ids = new Set([...srv, ...a, ...b].map((d) => d.id));
  return [...ids].sort();
}

async function tirerEtatInitial(m) {
  m.repA.reSync();
  m.repB.reSync();
  await avecDelai(Promise.all([m.repA.awaitInSync(), m.repB.awaitInSync()]), 20000, 'tirage initial (' + m.suffixe + ')');
  for (const [etiquette, client] of [['A', m.clientA], ['B', m.clientB]]) {
    const docs = await lireDocs(client, IDS_GRAINE);
    const manquants = IDS_GRAINE.filter((id) => !docs.some((d) => d.id === id));
    if (manquants.length > 0) throw new Error('état initial incomplet sur client ' + etiquette + ' : ' + manquants.join(', '));
  }
}

// Hors-ligne : les écritures locales ne partent plus (les évènements du fork sont ignorés).
async function deconnecter(m) {
  await Promise.all([m.repA.pause(), m.repB.pause()]);
}

// Reconnexion : start() après pause déclenche un RESYNC (push depuis le checkpoint + pull).
async function reconnecter(m) {
  await Promise.all([m.repA.start(), m.repB.start()]);
}

/* ══════════════════════ journal CRDT (inspection brute) ══════════════════════ */

async function journalCrdt(m, cote, id) {
  const client = cote === 'a' ? m.clientA : m.clientB;
  const [d] = await lireDocs(client, [id]);
  if (!d || !d.crdts) return null;
  return d.crdts.operations.map((rang, index) =>
    rang.map((op) => ({
      rang: index,
      creator: op.creator.slice(0, 8),
      corps: op.body.map((b) => ({
        si: b.selector ? 'selector' : b.ifMatch ? 'ifMatch' : b.ifNotMatch ? 'ifNotMatch' : '?',
        valeur: b.ifMatch ? b.ifMatch : b.ifNotMatch ? b.ifNotMatch : b.selector,
      })),
    }))
  );
}

function afficherJournal(etiquette, journal) {
  ligne(etiquette + ' :');
  if (!journal) { ligne('  (aucun journal)'); return; }
  journal.forEach((rang) => {
    rang.forEach((op) => {
      console.log('     rang ' + op.rang + ' · creator ' + op.creator + ' · ' + JSON.stringify(op.corps));
    });
  });
}

// « Extraction artisanale » : ce qu'un développeur devrait écrire lui-même pour
// tenter de retrouver les valeurs concurrentes d'un attribut. Montre le coût.
async function extractionArtisanale(m, cote, id, champ) {
  const client = cote === 'a' ? m.clientA : m.clientB;
  const [d] = await lireDocs(client, [id]);
  if (!d || !d.crdts) return [];
  const valeurs = [];
  d.crdts.operations.forEach((rang) => rang.forEach((op) => op.body.forEach((b) => {
    if (b.ifMatch && b.ifMatch.$set && Object.prototype.hasOwnProperty.call(b.ifMatch.$set, champ)) {
      valeurs.push({ creator: op.creator.slice(0, 8), valeur: b.ifMatch.$set[champ] });
    }
  })));
  return valeurs;
}

/* ══════════════════════ scénarios (doc 08 §Méthode) ══════════════════════ */

async function etatNoeuds(m, cote, ids) {
  const client = cote === 'a' ? m.clientA : m.clientB;
  const docs = await lireDocs(client, ids);
  return docs.map((d) => ({ id: d.id, fill: d.fill, size: d.size, name: d.name, order: d.order, supprime: !!d._deleted }));
}

async function scenarioA() {
  titre('SCÉNARIO a - même attribut modifié sur deux clients (conflit attendu : MVR visible)');
  const m = await creerMontage('sa');
  await tirerEtatInitial(m);

  await deconnecter(m);
  sousTitre('Hors-ligne des deux côtés');
  const docA = await m.clientA.nodes.findOne('n01').exec();
  await docA.updateCRDT({ ifMatch: { $set: { fill: 'bleu' } } });
  const docB = await m.clientB.nodes.findOne('n01').exec();
  await docB.updateCRDT({ ifMatch: { $set: { fill: 'vert' } } });
  ligne('client A : n01.fill ← « bleu »   ·   client B : n01.fill ← « vert »');
  await reconnecter(m);

  sousTitre('Après synchronisation');
  const res = await synchroniser(m);
  const [a, b] = await Promise.all([etatNoeuds(m, 'a', ['n01']), etatNoeuds(m, 'b', ['n01'])]);
  ligne('état client A : ' + JSON.stringify(a));
  ligne('état client B : ' + JSON.stringify(b));
  ligne('états identiques : ' + (res.convergent ? 'oui (' + res.tours + ' tour(s))' : 'NON'));
  afficherJournal('journal CRDT de n01 (client A)', await journalCrdt(m, 'a', 'n01'));
  ligne('valeurs concurrentes extractibles par inspection manuelle de fill : ' + JSON.stringify(await extractionArtisanale(m, 'a', 'n01', 'fill')));

  sousTitre('Résolution programmatique (l’UI choisit « bleu »)');
  const docA2 = await m.clientA.nodes.findOne('n01').exec();
  await docA2.updateCRDT({ ifMatch: { $set: { fill: 'bleu' } } });
  const res2 = await synchroniser(m);
  const [a2, b2] = await Promise.all([etatNoeuds(m, 'a', ['n01']), etatNoeuds(m, 'b', ['n01'])]);
  ligne('après résolution - A : ' + JSON.stringify(a2) + ' · B : ' + JSON.stringify(b2) + ' · convergents : ' + (res2.convergent ? 'oui' : 'non'));

  await fermerMontage(m);
  return { scenario: 'a', convergent: res.convergent, final: a };
}

async function scenarioB() {
  titre('SCÉNARIO b - suppression d’un côté, modification de l’autre');
  const m = await creerMontage('sb');
  await tirerEtatInitial(m);

  await deconnecter(m);
  sousTitre('Hors-ligne des deux côtés');
  const docA = await m.clientA.nodes.findOne('n05').exec();
  await docA.remove(); // le plugin traduit remove() en opération CRDT $set _deleted: true
  const docB = await m.clientB.nodes.findOne('n05').exec();
  await docB.updateCRDT({ ifMatch: { $set: { fill: 'orange' } } });
  ligne('client A : n05 supprimé (op $set _deleted=true)   ·   client B : n05.fill ← « orange »');
  await reconnecter(m);

  sousTitre('Après synchronisation');
  const res = await synchroniser(m);
  const [a, b] = await Promise.all([etatNoeuds(m, 'a', ['n05']), etatNoeuds(m, 'b', ['n05'])]);
  ligne('état client A : ' + JSON.stringify(a));
  ligne('état client B : ' + JSON.stringify(b));
  ligne('états identiques : ' + (res.convergent ? 'oui (' + res.tours + ' tour(s))' : 'NON'));
  afficherJournal('journal CRDT de n05 (client B)', await journalCrdt(m, 'b', 'n05'));
  const visiblesA = await m.clientA.nodes.find({ selector: {} }).exec();
  ligne('n05 visible dans les requêtes du client A : ' + (visiblesA.some((d) => d.id === 'n05') ? 'oui' : 'non (supprimé)'));
  ligne('la valeur « orange » du client B est-elle signalée quelque part comme conflit ? (aucune API - voir journal ci-dessus)');

  await fermerMontage(m);
  return { scenario: 'b', convergent: res.convergent, final: a };
}

async function scenarioC() {
  titre('SCÉNARIO c - insertion concurrente au même rang d’ordre (index fractionnaire)');
  const m = await creerMontage('sc');
  await tirerEtatInitial(m);

  await deconnecter(m);
  sousTitre('Hors-ligne des deux côtés (même rang « a05.5 »)');
  await m.clientA.nodes.insertCRDT({ ifMatch: { $set: { id: 'n21', name: 'Nœud inséré par A', fill: '#2F6FEB', size: 12, order: 'a05.5', text: 'A' } } });
  await m.clientB.nodes.insertCRDT({ ifMatch: { $set: { id: 'n22', name: 'Nœud inséré par B', fill: '#1F883D', size: 12, order: 'a05.5', text: 'B' } } });
  ligne('client A : insertion n21 (order a05.5)   ·   client B : insertion n22 (order a05.5)');
  await reconnecter(m);

  sousTitre('Après synchronisation');
  const res = await synchroniser(m);
  const [a, b] = await Promise.all([etatNoeuds(m, 'a', ['n21', 'n22']), etatNoeuds(m, 'b', ['n21', 'n22'])]);
  ligne('état client A : ' + JSON.stringify(a));
  ligne('état client B : ' + JSON.stringify(b));
  ligne('états identiques : ' + (res.convergent ? 'oui (' + res.tours + ' tour(s))' : 'NON'));
  ligne('les deux insertions sont conservées, mais deux nœuds partagent order = "a05.5" : aucun signalement de conflit, l’UI doit départager (départage déterministe par id à définir, doc 04).');

  await fermerMontage(m);
  return { scenario: 'c', convergent: res.convergent, final: { a, b } };
}

async function scenarioD() {
  titre('SCÉNARIO d - modifications disjointes (fusion SANS conflit attendue)');
  const m = await creerMontage('sd');
  await tirerEtatInitial(m);

  await deconnecter(m);
  sousTitre('Hors-ligne des deux côtés');
  const docA = await m.clientA.nodes.findOne('n02').exec();
  await docA.updateCRDT({ ifMatch: { $set: { name: 'En-tête (client A)' } } });
  const docB = await m.clientB.nodes.findOne('n02').exec();
  await docB.updateCRDT({ ifMatch: { $set: { size: 42 } } });
  ligne('client A : n02.name modifié   ·   client B : n02.size modifié');
  await reconnecter(m);

  sousTitre('Après synchronisation');
  const res = await synchroniser(m);
  const [a, b] = await Promise.all([etatNoeuds(m, 'a', ['n02']), etatNoeuds(m, 'b', ['n02'])]);
  ligne('état client A : ' + JSON.stringify(a));
  ligne('état client B : ' + JSON.stringify(b));
  ligne('états identiques : ' + (res.convergent ? 'oui (' + res.tours + ' tour(s))' : 'NON'));
  ligne('les deux modifications sont appliquées, aucun conflit signalé (comportement attendu).');

  await fermerMontage(m);
  return { scenario: 'd', convergent: res.convergent, final: a };
}

/* ══════════════════════ test de propriété (≥ 100 permutations) ══════════════════════ */

const OPS_A = [
  { op: 'set', id: 'n01', set: { fill: 'bleu' } },
  { op: 'set', id: 'n03', set: { name: 'Titre v2 (A)' } },
  { op: 'set', id: 'n07', set: { size: 40 } },
  { op: 'remove', id: 'n04' },
  { op: 'set', id: 'n11', set: { fill: '#CF222E' } },
  { op: 'insert', data: { id: 'n31', name: 'N31 (A)', fill: '#8250DF', size: 12, order: 'a31', text: 'A' } },
];
const OPS_B = [
  { op: 'set', id: 'n01', set: { fill: 'vert' } },
  { op: 'set', id: 'n03', set: { size: 24 } },
  { op: 'set', id: 'n07', set: { size: 48 } },
  { op: 'set', id: 'n04', set: { size: 28 } }, // suppression (A) vs modification (B) sur n04
  { op: 'remove', id: 'n06' },
  { op: 'insert', data: { id: 'n32', name: 'N32 (B)', fill: '#0550AE', size: 20, order: 'a32', text: 'B' } },
];

async function appliquerOps(m, cote, ops) {
  const client = cote === 'a' ? m.clientA : m.clientB;
  for (const o of ops) {
    if (o.op === 'set') {
      const doc = await client.nodes.findOne(o.id).exec();
      await doc.updateCRDT({ ifMatch: { $set: o.set } });
    } else if (o.op === 'remove') {
      const doc = await client.nodes.findOne(o.id).exec();
      await doc.remove();
    } else if (o.op === 'insert') {
      await client.nodes.insertCRDT({ ifMatch: { $set: o.data } });
    }
  }
}

const IDS_PROPRIETE = [...IDS_GRAINE, 'n31', 'n32'];

async function testPropriete(nombrePermutations) {
  titre('TEST DE PROPRIÉTÉ - ' + nombrePermutations + ' permutations de l’ordre d’arrivée');
  ligne('Les opérations locales de chaque client sont fixes (histoire linéaire) ; la permutation porte sur l’ordre des tours de synchronisation (qui arrive en premier, combien de tours).');
  const rnd = mulberry32(1337);
  let convergentes = 0;
  const echecs = [];
  const t0 = Date.now();

  for (let i = 1; i <= nombrePermutations; i++) {
    const m = await creerMontage('pp' + i);
    try {
      await tirerEtatInitial(m);
      await deconnecter(m);
      await appliquerOps(m, 'a', OPS_A);
      await appliquerOps(m, 'b', OPS_B);
      await reconnecter(m);
      const ordre = (tour) => (rnd() < 0.5 ? ['a', 'b'] : ['b', 'a']);
      const toursMax = 2 + Math.floor(rnd() * 5); // 2..6 tours
      const res = await synchroniser(m, { toursMax, ordre });
      if (res.convergent) {
        convergentes++;
      } else {
        echecs.push({ permutation: i, toursMax, details: res });
      }
    } catch (e) {
      echecs.push({ permutation: i, erreur: String(e.message || e) });
    } finally {
      await fermerMontage(m);
    }
    if (i % 25 === 0) ligne('… ' + i + '/' + nombrePermutations + ' permutations (' + convergentes + ' convergentes jusqu’ici)');
  }

  const secondes = ((Date.now() - t0) / 1000).toFixed(1);
  sousTitre('Résultat');
  ligne('permutations convergentes : ' + convergentes + '/' + nombrePermutations + ' (en ' + secondes + ' s)');
  if (echecs.length > 0) {
    ligne('premiers échecs : ' + JSON.stringify(echecs.slice(0, 3), null, 2));
  }
  return { convergentes, total: nombrePermutations, echecs: echecs.length };
}

/* ══════════════════════ exécution ══════════════════════ */

(async () => {
  console.log('Spike B - volet RxDB (plugin CRDT)');
  console.log('Date : ' + new Date().toISOString());
  console.log('Node : ' + process.version + ' · OS : ' + os.platform() + '/' + os.arch() + ' · Cœurs : ' + os.cpus().length);
  console.log('rxdb : ' + VERSION_RXDB + ' (storage-memory, plugin crdt)');

  const resultats = [];
  resultats.push(await scenarioA());
  resultats.push(await scenarioB());
  resultats.push(await scenarioC());
  resultats.push(await scenarioD());
  const propriete = await testPropriete(100);

  titre('RÉSUMÉ RXDB');
  resultats.forEach((r) => ligne('scénario ' + r.scenario + ' - convergence : ' + (r.convergent ? 'oui' : 'NON')));
  ligne('propriété (ordre d’arrivée) : ' + propriete.convergentes + '/' + propriete.total);
  console.log('');

  process.exit(0);
})().catch((e) => {
  console.error('ÉCHEC DU SCRIPT :', e);
  process.exit(1);
});
