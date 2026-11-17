import assert from 'node:assert/strict';
import fs from 'node:fs';
import {purchasePrice,banReason} from '../dist/catalog-rules.js';
const data=JSON.parse(fs.readFileSync('dist/data.json','utf8'));
const bonds=new Map(data.bonds.map(b=>[b.bondId,b]));
const op=name=>data.operators.find(o=>o.name===name);
const blocked=(name,ids)=>banReason(op(name),new Set(ids),bonds);
for(const elite of [false,true]){
 assert.equal(purchasePrice(op('真理'),data.rules.training,elite),1);
 assert.equal(purchasePrice(op('至简'),data.rules.training,elite),1);
 assert.equal(purchasePrice(op('温蒂'),data.rules.training,elite),3,'Sale-price trait must not change purchase price');
 assert.equal(purchasePrice(op('塔露拉'),data.rules.training,elite),4);
 for(const o of data.customOperators)assert.equal(purchasePrice(o,data.rules.training,elite),4);
 for(const o of data.operators.filter(o=>o.hidden))assert.equal(purchasePrice(o,data.rules.training,elite),null);
}
assert.equal(blocked('塔露拉',['ursusShip']),'core');
assert.equal(blocked('塔露拉',['arcaneShip']),null,'One banned additional bond must not hide a unit with another available bond');
assert.equal(blocked('塔露拉',['arcaneShip','emptyShip']),'additional');
assert.equal(blocked('水灯心',['soloShip']),null);
assert.equal(blocked('水灯心',['soloShip','skillfulShip']),'additional');
assert.equal(blocked('锏',['kazimierzShip']),'core');
assert.equal(blocked('锏',[]),null,'No additional bonds must not count as all additional bonds banned');
assert.equal(blocked('锏',['suntShip']),null);
assert.equal(blocked('真理',['indomShip']),null,'Do not infer extra bonds from profession or faction');
assert.ok(data.customOperators.some(o=>o.normal.bonds.includes('ursusShip')));
for(const o of data.customOperators.filter(o=>o.normal.bonds.includes('ursusShip')))assert.equal(banReason(o,new Set(['ursusShip']),bonds),'core');
console.log('Verified purchase exceptions, special acquisition, multi-core, partial/all additional bonds, Absolute Art and custom candidates.');
