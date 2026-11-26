// Checks that the English and Polish UI strings have the same keys and that every
// key referenced by the page exists.  Run:  node tests/check_i18n.js
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = path.join(__dirname, "..", "app", "wanemu", "static");
const ctx = {
  localStorage: { getItem: () => null, setItem: () => {} },
  location: { search: "" },
  URLSearchParams,
  document: {},
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dir, "i18n.js"), "utf8") + "\nthis.I18N = I18N;", ctx);

const { en, pl } = ctx.I18N;
const errors = [];
const missing = (a, b) => Object.keys(a).filter(k => !(k in b));
missing(en, pl).forEach(k => errors.push(`missing in pl: ${k}`));
missing(pl, en).forEach(k => errors.push(`missing in en: ${k}`));

const app = fs.readFileSync(path.join(dir, "app.js"), "utf8");
const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const used = new Set([
  ...[...app.matchAll(/\bt\("([\w.]*\w)"/g)].map(m => m[1]),
  ...[...html.matchAll(/data-i18n(?:-tip|-title)?="([\w.]+)"/g)].map(m => m[1]),
  ...[...app.matchAll(/(?:title|unit): "((?:sec|unit)\.[\w.]+)"/g)].map(m => m[1]),
  ...[...app.matchAll(/\["\w+", "(opt\.[\w.]+)"\]/g)].map(m => m[1]),
]);
for (const m of app.matchAll(/\{ key: "(\w+)"/g)) used.add(`f.${m[1]}`).add(`f.${m[1]}.info`);
[...used].filter(k => !(k in en)).forEach(k => errors.push(`used but not defined: ${k}`));

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`i18n OK: ${Object.keys(en).length} keys, ${used.size} referenced`);
