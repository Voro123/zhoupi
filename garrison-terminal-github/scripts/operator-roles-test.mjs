import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyOperator,stackAssessment,ROLE_DEFINITIONS,STACK_KINDS} from '../dist/operator-roles.js';
const data=JSON.parse(fs.readFileSync(new URL('../dist/data.json',import.meta.url),'utf8'));
const op=name=>{const o=data.operators.find(o=>o.name===name);assert.ok(o,name);return o;};
const tags=(name,elite=false)=>classifyOperator(op(name),elite);
const has=(name,elite=false)=>tags(name,elite).some(r=>r.id==='stack');
assert.deepEqual(ROLE_DEFINITIONS.map(r=>r.id),['stack','economy']);
for(const elite of [false,true]){
 const counts={stack:0,economy:0,none:0};
 for(const o of data.operators){const roles=classifyOperator(o,elite);assert.equal(new Set(roles.map(r=>r.id)).size,roles.length);if(!roles.length)counts.none++;for(const r of roles){assert.ok(['stack','economy'].includes(r.id));assert.ok(r.reason);if(r.id==='stack'){assert.ok(STACK_KINDS.some(k=>k.id===r.kind));assert.ok(r.amount>=4);assert.equal(stackAssessment(o,elite).qualified,true);assert.notEqual(o[elite?'elite':'normal'].traitType,'单次叠加');}counts[r.id]++;}}
 assert.deepEqual(counts,elite?{stack:61,economy:26,none:56}:{stack:55,economy:26,none:62});
 for(const o of data.customOperators)assert.deepEqual(classifyOperator(o,elite),[]);
}
// One-off gains never qualify, even if their numeric amount is much higher than four.
for(const name of ['灰喉','黍','仇白','逻各斯'])for(const elite of [false,true])assert.equal(has(name,elite),false,name);
for(const name of ['慕斯','卡达','夏栎','幽灵鲨','地灵','蓝毒','历阵锐枪芬','Mon3tr','凛御银灰','阿米娅','塔露拉','折桠','乌啾','铃兰','塞雷娅'])for(const elite of [false,true])assert.equal(has(name,elite),false,name);
// Initial and elite stats are judged separately, not by the best possible state.
for(const name of ['深靛','艾丝黛尔','野鬃','陨星','铸铁','星源']){assert.equal(has(name),false,name);assert.equal(has(name,true),true,name+' elite');}
for(const name of ['折光','泡泡','砾','云迹','蛇屠箱','初雪','风絮','罗比菈塔','华法琳','荒芜拉普兰德','引星棘刺','帕拉斯'])assert.equal(has(name),true,name);
assert.equal(stackAssessment(op('寒檀')).amount,6,'Separate repeated phases of the same bond combine');
assert.equal(has('Miss.Christine'),true,'Different bonds are summed under the requested total threshold');assert.equal(stackAssessment(op('Miss.Christine')).amount,6);assert.equal(stackAssessment(op('复奏')).amount,4);assert.equal(has('空弦'),true);assert.equal(has('青枳'),true);assert.equal(has('渡桥'),true);assert.equal(stackAssessment(op('渡桥')).conditional,true);
assert.equal(stackAssessment(op('泡泡')).amount,8);assert.match(stackAssessment(op('泡泡')).reason,/至少触发 1 次/);assert.match(stackAssessment(op('泡泡')).reason,/上限不等于实际获得/);
assert.equal(stackAssessment(op('烈夏')).kind,'temporary');assert.match(stackAssessment(op('烈夏')).reason,/不等于永久积累/);
for(const name of ['风絮','旅骨','棘刺','溯光星源'])assert.equal(tags(name).some(r=>r.id==='economy'),false);
for(const name of ['星极','真理','至简','温蒂','奥斯塔','白铁','酒神'])assert.ok(tags(name).some(r=>r.id==='economy'));
for(const name of ['铃兰','塞雷娅'])assert.deepEqual(tags(name).map(r=>r.id),['economy']);
const synthetic=structuredClone(op('灰喉'));synthetic.normal.trait='单次获得999层';assert.equal(classifyOperator(synthetic).some(r=>r.id==='stack'),false,'Do not use amount alone to count one-shot gains');
console.log('PASS: repeatable >=4 threshold; initial/elite separation; one-off/low/boost/conversion/copy exclusions; aggregate bonds and phases; trigger counts versus cap; temporary layers; unchanged economy tags.');
