// Deployment checks use committed files only; raw game tables are a separate workflow.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../dist/',import.meta.url));
const json=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const data=json('data.json'),art=json('assets/catalog.json');
const checked=new Set();
function asset(relative) {
  assert.equal(typeof relative,'string','Missing local asset path');
  const full=path.resolve(root,relative);
  assert.ok(full.startsWith(root),'Asset must stay within dist: '+relative);
  assert.ok(fs.statSync(full).isFile(),'Missing file: '+relative);
  checked.add(relative);
}
for(const name of ['index.html','style.css','app.js','operator-roles.js','catalog-rules.js','assets/talulah.webp'])asset(name);
const all=[...data.operators,...data.customOperators];
assert.equal(new Set(all.map(o=>o.chessId)).size,all.length,'Duplicate operator slots');
const bonds=new Set(data.bonds.map(b=>b.bondId));
for(const o of all) {
  for(const variant of [o,o.backup].filter(Boolean)) {
    asset(variant.avatar);asset(variant.portrait);
    for(const state of [variant.normal,variant.elite]) {
      assert.ok(state.skills[variant.defaultSkill],'Missing default skill: '+o.chessId);
      for(const id of state.bonds)assert.ok(bonds.has(id),'Unknown bond: '+id);
    }
  }
}
for(const group of ['bonds','strategies','equipment'])for(const entry of Object.values(art[group]))asset(entry.image);
for(const b of data.bonds)assert.ok(art.bonds[b.bondId],'Missing bond icon: '+b.bondId);
for(const s of data.strategies)assert.ok(art.strategies[s.bandId],'Missing strategy image: '+s.bandId);
for(const e of data.equipment)assert.ok(art.equipment[e.itemId],'Missing equipment image: '+e.itemId);
// Avoid deploying a page with an accidentally renamed entrypoint.
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  const url=match[1];
  if(!/^(?:https?:|data:|#|\/\/)/.test(url))asset(url.split(/[?#]/)[0]);
}
console.log(`Static deployment ready: ${all.length} operator slots and ${checked.size} local files verified; no raw tables or npm dependencies needed.`);
