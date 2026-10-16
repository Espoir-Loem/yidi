/*
 * Spike B - volet Automerge - doc 08 §Spike B (contre-candidat du §Méthode.4).
 *
 * Mêmes scénarios que rxdb-crdt.js sur le même mini-scenegraph de 20 nœuds :
 *   a. même attribut modifié sur deux clients (l'attente doc 04/06 : conflit MVR visible) ;
 *   b. suppression d'un côté, modification de l'autre ;
 *   c. insertion concurrente au même rang d'ordre (index fractionnaire) ;
 *   d. modifications disjointes (fusion sans conflit) ;
 *   + test de propriété : ≥ 100 permutations de l'ordre d'arrivée → même état final.
 *
 * Automerge expose getConflicts() : sémantique multi-valeurs explicite. C'est le point
 * de comparaison central avec le plugin CRDT de RxDB (voir RESULTATS.md).
 *
 * Note d'API (v3) : change()/merge() consomment les documents passés (erreur
 * « Attempting to change an outdated document » / « recursive use … unsafe aliasing »).
 * On ne passe donc aux opérations que des clone() - les réplicas restent utilisables.
 */

import { init, change, clone, merge, getConflicts } from '@automerge/automerge';
import { readFileSync } from 'node:fs';
import os from 'node:os';

let VERSION_AM = '?';
try {
  VERSION_AM = JSON.parse(readFileSync(new URL('./node_modules/@automerge/automerge/package.json', import.meta.url), 'utf8')).version;
} catch { /* introuvable */ }

/* ══════════════════════ utilitaires ══════════════════════ */

function stableStringify(valeur) {
  if (Array.isArray(valeur)) return '[' + valeur.map(stableStringify).join(',') + ']';
  if (valeur && typeof valeur === 'object') {
    const cles = Object.keys(valeur).sort();
    return '{' + cles.map((k) => JSON.stringify(k) + ':' + stableStringify(valeur[k])).join(',') + '}';
  }
  return JSON.stringify(valeur);
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
const conflits = (doc, prop) => {
  const c = getConflicts(doc, prop);
  return c === undefined ? 'aucun' : JSON.stringify(c);
};

/* ══════════════════════ graine ══════════════════════ */

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

function creerBase() {
  return change(init(), (d) => {
    d.nodes = {};
    IDS_GRAINE.forEach((id, i) => { d.nodes[id] = noeudGraine(id, i); });
  });
}

const resumeNoeud = (n) => (n === undefined ? 'absent' : JSON.stringify({ id: n.id, fill: n.fill, size: n.size, name: n.name, order: n.order }));

/* ══════════════════════ scénarios ══════════════════════ */

function scenarioA() {
  titre('SCÉNARIO a - même attribut modifié sur deux clients (conflit attendu : MVR visible)');
  const base = creerBase();
  let A = clone(base);
  let B = clone(base);

  sousTitre('Hors-ligne des deux côtés');
  A = change(A, (d) => { d.nodes.n01.fill = 'bleu'; });
  B = change(B, (d) => { d.nodes.n01.fill = 'vert'; });
  ligne('client A : n01.fill ← « bleu »   ·   client B : n01.fill ← « vert »');

  sousTitre('Après synchronisation (merge)');
  const m = merge(clone(A), clone(B));
  ligne('état fusionné : ' + resumeNoeud(m.nodes.n01));
  ligne('getConflicts(n01, fill) → ' + conflits(m.nodes.n01, 'fill'));

  sousTitre('Résolution programmatique (l’UI choisit « bleu »)');
  const resolu = change(clone(m), (d) => { d.nodes.n01.fill = 'bleu'; });
  ligne('getConflicts après résolution → ' + conflits(resolu.nodes.n01, 'fill'));
  const A2 = merge(clone(A), clone(resolu));
  const B2 = merge(clone(B), clone(resolu));
  const egaux = stableStringify(A2) === stableStringify(B2) && stableStringify(A2) === stableStringify(resolu);
  ligne('propagation aux deux clients - A : ' + resumeNoeud(A2.nodes.n01) + ' · B : ' + resumeNoeud(B2.nodes.n01) + ' · convergents : ' + (egaux ? 'oui' : 'NON'));

  return { scenario: 'a', convergent: egaux };
}

function scenarioB() {
  titre('SCÉNARIO b - suppression d’un côté, modification de l’autre');
  const base = creerBase();
  let A = clone(base);
  let B = clone(base);

  sousTitre('Hors-ligne des deux côtés');
  A = change(A, (d) => { delete d.nodes.n05; });
  B = change(B, (d) => { d.nodes.n05.fill = 'orange'; });
  ligne('client A : n05 supprimé   ·   client B : n05.fill ← « orange »');

  sousTitre('Après synchronisation (merge)');
  const m = merge(clone(A), clone(B));
  const present = Object.prototype.hasOwnProperty.call(m.nodes, 'n05');
  ligne('n05 présent dans la carte : ' + (present ? 'oui' : 'non (la suppression l’emporte)'));
  ligne('état n05 : ' + resumeNoeud(m.nodes.n05));
  ligne('getConflicts(nodes, n05) → ' + conflits(m.nodes, 'n05'));

  return { scenario: 'b', convergent: true };
}

function scenarioC() {
  titre('SCÉNARIO c - insertion concurrente au même rang d’ordre (index fractionnaire)');
  const base = creerBase();
  let A = clone(base);
  let B = clone(base);

  sousTitre('Hors-ligne des deux côtés (même rang « a05.5 »)');
  A = change(A, (d) => { d.nodes.n21 = { id: 'n21', name: 'Nœud inséré par A', fill: '#2F6FEB', size: 12, order: 'a05.5', text: 'A' }; });
  B = change(B, (d) => { d.nodes.n22 = { id: 'n22', name: 'Nœud inséré par B', fill: '#1F883D', size: 12, order: 'a05.5', text: 'B' }; });
  ligne('client A : insertion n21 (order a05.5)   ·   client B : insertion n22 (order a05.5)');

  sousTitre('Après synchronisation (merge)');
  const m = merge(clone(A), clone(B));
  ligne('état client fusionné : ' + JSON.stringify([resumeNoeud(m.nodes.n21), resumeNoeud(m.nodes.n22)]));
  ligne('getConflicts(n21, order) → ' + conflits(m.nodes.n21, 'order') + ' · getConflicts(n22, order) → ' + conflits(m.nodes.n22, 'order'));
  ligne('les deux insertions sont conservées, mais deux nœuds partagent order = "a05.5" : même constat que côté RxDB - le rang n’est pas un registre, l’UI doit départager.');

  return { scenario: 'c', convergent: true };
}

function scenarioD() {
  titre('SCÉNARIO d - modifications disjointes (fusion SANS conflit attendue)');
  const base = creerBase();
  let A = clone(base);
  let B = clone(base);

  sousTitre('Hors-ligne des deux côtés');
  A = change(A, (d) => { d.nodes.n02.name = 'En-tête (client A)'; });
  B = change(B, (d) => { d.nodes.n02.size = 42; });
  ligne('client A : n02.name modifié   ·   client B : n02.size modifié');

  sousTitre('Après synchronisation (merge)');
  const m = merge(clone(A), clone(B));
  ligne('état fusionné : ' + resumeNoeud(m.nodes.n02));
  ligne('getConflicts(n02, name) → ' + conflits(m.nodes.n02, 'name') + ' · getConflicts(n02, size) → ' + conflits(m.nodes.n02, 'size'));
  ligne('les deux modifications sont appliquées, aucun conflit signalé (comportement attendu).');

  return { scenario: 'd', convergent: true };
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
  { op: 'set', id: 'n04', set: { size: 28 } },
  { op: 'remove', id: 'n06' },
  { op: 'insert', data: { id: 'n32', name: 'N32 (B)', fill: '#0550AE', size: 20, order: 'a32', text: 'B' } },
];

function appliquerOps(doc, ops) {
  return change(doc, (d) => {
    for (const o of ops) {
      if (o.op === 'set') Object.assign(d.nodes[o.id], o.set);
      else if (o.op === 'remove') delete d.nodes[o.id];
      else if (o.op === 'insert') d.nodes[o.data.id] = { ...o.data };
    }
  });
}

async function testPropriete(nombrePermutations) {
  titre('TEST DE PROPRIÉTÉ - ' + nombrePermutations + ' permutations de l’ordre d’arrivée');
  ligne('Les opérations locales de chaque client sont fixes (histoire linéaire) ; la permutation porte sur l’ordre et la multiplicité des fusions (commutativité, associativité, idempotence).');
  const rnd = mulberry32(1337);
  let convergentes = 0;
  const echecs = [];
  const t0 = Date.now();

  for (let i = 1; i <= nombrePermutations; i++) {
    const base = creerBase();
    const A = appliquerOps(clone(base), OPS_A);
    const B = appliquerOps(clone(base), OPS_B);
    const reference = merge(clone(A), clone(B));

    // Ordre d'arrivée aléatoire : les DEUX réplicas arrivent au moins une fois
    // (sinon on ne rejoue pas toutes les opérations), puis répétitions (idempotence).
    const sequence = rnd() < 0.5 ? [A, B] : [B, A];
    const longueur = 2 + Math.floor(rnd() * 5); // 2..6
    for (let k = sequence.length; k < longueur; k++) sequence.push(rnd() < 0.5 ? A : B);
    for (let k = sequence.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      [sequence[k], sequence[j]] = [sequence[j], sequence[k]];
    }
    let acc = clone(sequence[0]);
    for (let k = 1; k < sequence.length; k++) {
      acc = merge(acc, clone(sequence[k]));
    }

    const etatOk = stableStringify(acc) === stableStringify(reference);
    const conflitsOk =
      JSON.stringify(getConflicts(acc.nodes.n01, 'fill') || null) ===
      JSON.stringify(getConflicts(reference.nodes.n01, 'fill') || null);
    if (etatOk && conflitsOk) {
      convergentes++;
    } else {
      echecs.push({ permutation: i, longueur, sequence: sequence.map((s) => (s === A ? 'A' : 'B')), etatOk, conflitsOk });
    }
    if (i % 25 === 0) ligne('… ' + i + '/' + nombrePermutations + ' permutations (' + convergentes + ' convergentes jusqu’ici)');
  }

  const secondes = ((Date.now() - t0) / 1000).toFixed(1);
  sousTitre('Résultat');
  ligne('permutations convergentes : ' + convergentes + '/' + nombrePermutations + ' (en ' + secondes + ' s)');
  if (echecs.length > 0) ligne('premiers échecs : ' + JSON.stringify(echecs.slice(0, 3), null, 2));
  return { convergentes, total: nombrePermutations, echecs: echecs.length };
}

/* ══════════════════════ exécution ══════════════════════ */

(async () => {
  console.log('Spike B - volet Automerge');
  console.log('Date : ' + new Date().toISOString());
  console.log('Node : ' + process.version + ' · OS : ' + os.platform() + '/' + os.arch() + ' · Cœurs : ' + os.cpus().length);
  console.log('@automerge/automerge : ' + VERSION_AM);

  const resultats = [scenarioA(), scenarioB(), scenarioC(), scenarioD()];
  const propriete = await testPropriete(100);

  titre('RÉSUMÉ AUTOMERGE');
  resultats.forEach((r) => ligne('scénario ' + r.scenario + ' - convergence : ' + (r.convergent ? 'oui' : 'NON')));
  ligne('propriété (ordre d’arrivée) : ' + propriete.convergentes + '/' + propriete.total);
  console.log('');

  process.exit(0);
})().catch((e) => {
  console.error('ÉCHEC DU SCRIPT :', e);
  process.exit(1);
});
