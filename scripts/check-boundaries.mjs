#!/usr/bin/env node
/**
 * Verification mecanique des frontieres de dependances (doc 10 §4).
 * Usage : pnpm check:boundaries
 *
 * Regles :
 *   1. chaque paquet de packages/* doit figurer dans l'allowlist ;
 *   2. ses dependances *runtime* (champ dependencies) doivent y figurer aussi ;
 *   3. un paquet ne peut jamais dependre d'une app (apps/*) ;
 *   4. une app ne peut jamais dependre d'une autre app (apps/*).
 * Les devDependencies (outillage) ne sont pas contraintes ici.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** Allowlist des dependances runtime par paquet (doc 10 §4). */
const ALLOWLIST = {
  "@yidik/ast": [],
  "@yidik/scene": ["@yidik/ast"],
  "@yidik/layout": ["@yidik/ast"],
  "@yidik/tokens": ["@yidik/ast"],
  "@yidik/sync": ["@yidik/ast", "@yidik/scene", "@automerge/automerge"],
};

const violations = [];

async function listDirectories(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => join(dir, entry.name));
  } catch {
    return []; // dossier absent (avant le premier scaffold)
  }
}

async function readPackageJson(dir) {
  return JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
}

const packageDirs = await listDirectories("packages");
const appDirs = await listDirectories("apps");

const appNames = new Set();
for (const dir of appDirs) {
  appNames.add((await readPackageJson(dir)).name);
}

for (const dir of packageDirs) {
  const pkg = await readPackageJson(dir);
  const allowed = ALLOWLIST[pkg.name];
  if (!allowed) {
    violations.push(`${pkg.name} : paquet absent de l'allowlist (doc 10 §4)`);
    continue;
  }
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (appNames.has(dep)) {
      violations.push(`${pkg.name} : dependance vers une app (${dep}) interdite (doc 10 §4)`);
      continue;
    }
    if (!allowed.includes(dep)) {
      violations.push(
        `${pkg.name} : dependance runtime interdite -> ${dep} (autorise : ${allowed.join(", ") || "aucune"})`,
      );
    }
  }
}

for (const dir of appDirs) {
  const app = await readPackageJson(dir);
  for (const dep of Object.keys(app.dependencies ?? {})) {
    if (appNames.has(dep)) {
      violations.push(
        `${app.name} : dependance d'une app vers une app (${dep}) interdite (doc 10 §4)`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("Frontieres de dependances : ECHEC (doc 10 §4)");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Frontieres de dependances : OK (${packageDirs.length} paquet(s), ${appDirs.length} app, doc 10 §4)`,
  );
}
