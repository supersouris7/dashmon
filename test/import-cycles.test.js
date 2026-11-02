"use strict";
// No import cycle between modules, in the browser (public/js, ES modules) or
// on the server (lib, CommonJS). A cycle makes the loading order matter: a
// module may then read an import that is not initialised yet.
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PATTERNS = [
  /(?:import|export)\s[^"';]*?from\s+["'](\.{1,2}\/[^"']+)["']/g,
  /require\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g
];

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return /\.(m?js)$/.test(entry.name) ? [full] : [];
  });
}

function resolve(from, spec) {
  const base = path.resolve(path.dirname(from), spec);
  for (const candidate of [base, base + ".js", path.join(base, "index.js")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function findCycle(files) {
  const graph = new Map(
    files.map(file => {
      const source = fs.readFileSync(file, "utf8");
      const deps = PATTERNS.flatMap(re => [...source.matchAll(re)].map(m => resolve(file, m[1])));
      return [file, deps.filter(dep => dep && files.includes(dep))];
    })
  );
  const done = new Set();
  const stack = [];
  function visit(file) {
    if (stack.includes(file)) return [...stack.slice(stack.indexOf(file)), file];
    if (done.has(file)) return null;
    stack.push(file);
    for (const dep of graph.get(file)) {
      const cycle = visit(dep);
      if (cycle) return cycle;
    }
    stack.pop();
    done.add(file);
    return null;
  }
  for (const file of files) {
    const cycle = visit(file);
    if (cycle) return cycle.map(item => path.relative(ROOT, item));
  }
  return null;
}

for (const dir of ["public/js", "lib", "widgets"]) {
  const cycle = findCycle(listFiles(path.join(ROOT, dir)));
  assert.equal(cycle, null, `cycle d'imports : ${cycle && cycle.join(" -> ")}`);
  console.log(`PASS imports : aucun cycle dans ${dir}`);
}
