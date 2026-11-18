import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const data=JSON.parse(fs.readFileSync('dist/data.json','utf8'));
const executable=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/home/Voro/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const browser=await chromium.launch({headless:true,...(fs.existsSync(executable)?{executablePath:executable}:{}),args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1080}});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const member=(o,elite=false)=>({chessId:o.chessId,elite});
const solo=data.operators.filter(o=>o.normal.bonds.includes('soloShip'));
const harmony=data.operators.find(o=>o.normal.bonds.includes('maniShip'));
const ursus=data.operators.filter(o=>o.normal.bonds.includes('ursusShip'));
const raiders=data.operators.filter(o=>o.normal.bonds.includes('raidShip'));
const tal=data.operators.find(o=>o.name==='塔露拉');
const bond=id=>page.locator(`.dock-bond[data-bond-detail="${id}"]`);
async function roster(squad,capacity=8) {
  await page.evaluate(value=>localStorage.setItem('garrison-nexus-v1',JSON.stringify(value)),{squad,capacity});
  await page.goto('http://localhost:4173/#operators');
  await page.reload();
  await page.waitForSelector('.tile-portrait');
}
try {
  await page.goto('http://localhost:4173');
  await roster([member(tal,true)]);
  const avatar=page.locator('.dock-member');
  await avatar.locator('.dock-slot').hover();
  await page.waitForSelector('#hover-card:not([hidden])');
  assert.match(await page.locator('#hover-card .hover-heading small').textContent(),/精锐/);
  assert.equal(await page.locator('.hover-trait').textContent(),tal.elite.trait);
  assert.deepEqual(await page.locator('.hover-skill b').allTextContents(),[String(tal.elite.skills[tal.defaultSkill].sp.initSp),String(tal.elite.skills[tal.defaultSkill].sp.spCost)]);
  assert.equal(await avatar.locator('.dock-remove').evaluate(el=>getComputedStyle(el).opacity),'1');
  await avatar.locator('.dock-slot').click();
  assert.equal(await page.locator('[data-detail-state=elite]').getAttribute('class'),'active');
  await page.keyboard.press('Escape');
  await page.locator('.main-nav [data-nav=squad]').click();
  await page.locator('[data-member-state][data-value=normal]').click();
  await page.locator('.squad-row [data-op-tip]').hover();
  await page.waitForSelector('#hover-card:not([hidden])');
  assert.equal(await page.locator('.hover-trait').textContent(),tal.normal.trait);
  await page.locator('.dock-member .dock-slot').hover();
  await page.waitForTimeout(180);
  assert.equal(await page.locator('.hover-trait').textContent(),tal.normal.trait);
  await page.locator('.dock-remove').click();
  assert.equal(await page.locator('.dock-member').count(),0);
  assert.equal(await page.locator('#overlay').isVisible(),false);
  assert.equal(await page.locator('#hover-card').isVisible(),false);
  assert.equal(await page.locator('.squad-row').count(),0);
  await page.reload();
  await page.waitForSelector('.squad-page');
  assert.equal(await page.locator('.dock-member').count(),0,'Removal persists');
  assert.match(await page.locator('.dock-bonds').textContent(),/加入干员后/);

  await roster([member(solo[0])]);
  assert.equal(await bond('soloShip').locator('b').textContent(),'1/1');
  await roster(solo.slice(0,2).map(o=>member(o)));
  assert.equal(await bond('soloShip').locator('b').textContent(),'2/1');
  assert.equal(await bond('soloShip').evaluate(el=>el.classList.contains('active')),false,'Two solo members must disable 独行');
  await roster(ursus.slice(0,2).map(o=>member(o)));
  assert.equal(await bond('ursusShip').locator('b').textContent(),'2/3');
  assert.equal(await bond('ursusShip').evaluate(el=>el.classList.contains('active')),false);
  await roster([...ursus.slice(0,2).map(o=>member(o)),member(harmony)]);
  assert.equal(await bond('ursusShip').locator('b').textContent(),'3/3','调和 contributes one to an existing core');
  assert.equal(await bond('maniShip').locator('b').textContent(),'1/1');
  await bond('ursusShip').click();
  assert.match(await page.locator('.bond-detail-title').textContent(),/乌萨斯/);
  await page.keyboard.press('Escape');
  await roster([...ursus.slice(0,3).map(o=>member(o)),...raiders.slice(0,2).map(o=>member(o))]);
  assert.equal(await bond('ursusShip').locator('b').textContent(),'3/3');
  assert.equal(await bond('raidShip').locator('b').textContent(),'2/2','Additional bonds appear alongside cores');
  await page.locator(`.dock-member[data-op-tip="${raiders[0].chessId}"]`).hover();
  await page.locator(`.dock-remove[data-add="${raiders[0].chessId}"]`).click();
  assert.equal(await bond('raidShip').locator('b').textContent(),'1/2');
  assert.equal(await bond('raidShip').evaluate(el=>el.classList.contains('active')),false,'Removing a member immediately dims an incomplete bond');

  // A reached one-person bond precedes an incomplete two-person core;
  // incomplete bonds are then ordered by their current member counts.
  await roster([member(solo[0]),...ursus.slice(0,2).map(o=>member(o)),member(raiders[0])]);
  assert.deepEqual(await page.locator('.dock-bond').evaluateAll(els=>els.slice(0,2).map(el=>el.dataset.bondDetail)),['soloShip','ursusShip']);
  assert.deepEqual(await page.locator('.dock-bond:not(.active) b').allTextContents(),['2/3','1/3','1/2','1/2']);
  await page.locator('.main-nav [data-nav=squad]').click();
  assert.deepEqual(await page.locator('.squad-bond-row').evaluateAll(els=>els.slice(0,2).map(el=>el.dataset.bondDetail)),['soloShip','ursusShip']);
  await page.setViewportSize({width:390,height:844});
  assert.deepEqual(await page.locator('.dock-bond').evaluateAll(els=>els.slice(0,2).map(el=>el.dataset.bondDetail)),['soloShip','ursusShip']);
  await page.setViewportSize({width:1440,height:1080});

  // No current slot carries 绝技; exercise its elite-only rule with a response fixture.
  const fixture=structuredClone(data);
  fixture.operators.slice(0,2).forEach(o=>{o.normal.bonds.push('suntShip');o.elite.bonds.push('suntShip');});
  await page.route('**/data.json',route=>route.fulfill({json:fixture}));
  await roster(fixture.operators.slice(0,2).map(o=>member(o)));
  assert.equal(await bond('suntShip').locator('b').textContent(),'0/2');
  assert.equal(await bond('suntShip').evaluate(el=>el.classList.contains('active')),false);
  await roster(fixture.operators.slice(0,2).map(o=>member(o,true)));
  assert.equal(await bond('suntShip').locator('b').textContent(),'2/2');
  await page.unroute('**/data.json');

  await roster([...ursus.slice(0,3).map(o=>member(o)),member(harmony)]);
  assert.equal(await bond('ursusShip').locator('b').textContent(),'4/3','Show the full count above the activation threshold');
  assert.equal(await bond('ursusShip').evaluate(el=>el.classList.contains('active')),true);
  assert.equal(await page.locator('#capacity-dock').isChecked(),false);
  await page.locator('#capacity-dock').check();
  assert.equal(await page.locator('.dock-slot').count(),9);
  await page.reload();await page.waitForSelector('#capacity-dock');
  assert.equal(await page.locator('#capacity-dock').isChecked(),true,'Dock capacity setting persists');
  await page.locator('#capacity-dock').uncheck();
  assert.equal(await page.locator('.dock-slot').count(),8);
  await roster(data.operators.slice(0,9).map(o=>member(o)),9);
  await page.locator('#capacity-dock').click();
  assert.equal(await page.locator('#capacity-dock').isChecked(),true,'Cannot lower capacity while nine members are selected');
  assert.equal(await page.locator('.dock-member').count(),9);
  assert.match(await page.locator('#toast').textContent(),/先.*减少到 8/);
  for(const width of [1440,800,600,390,320]) {
    await page.setViewportSize({width,height:844});
    assert.equal(await page.locator('.dock-slot').count(),9);
    const layout=await page.locator('#squad-dock').evaluate(el=>({right:el.getBoundingClientRect().right,slots:[...el.querySelectorAll('.dock-slot')].map(s=>s.getBoundingClientRect().right),width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}));
    const typography=await page.locator('.dock-bond').evaluateAll(els=>els.map(el=>{
      const name=el.querySelector('span'),count=el.querySelector('b'),a=name.getBoundingClientRect(),b=count.getBoundingClientRect();
      return {nameSize:getComputedStyle(name).fontSize,countSize:getComputedStyle(count).fontSize,offset:Math.abs((a.top+a.bottom)/2-(b.top+b.bottom)/2)};
    }));
    assert.ok(typography.every(t=>t.nameSize===t.countSize&&t.offset<1),'Counts match name size and vertical center');
    assert.equal(layout.overflow,false,`No horizontal overflow at ${width}px`);
    assert.ok(layout.right<=layout.width+1&&layout.slots.every(right=>right<=layout.right),`All nine slots fit at ${width}px`);
  }
  await page.setViewportSize({width:1440,height:1080});
  await page.locator('.dock-member').first().hover();
  await page.waitForSelector('#hover-card:not([hidden])');
  await page.screenshot({path:'/tmp/garrison-dock-desktop.png'});
  const touchContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const touch=await touchContext.newPage();
  await touch.addInitScript(value=>localStorage.setItem('garrison-nexus-v1',JSON.stringify(value)),{squad:data.operators.slice(0,9).map(o=>member(o)),capacity:9});
  await touch.goto('http://localhost:4173');
  await touch.waitForSelector('.dock-member');
  assert.equal(await touch.locator('.dock-remove').first().evaluate(el=>getComputedStyle(el).opacity),'1');
  await touch.screenshot({path:'/tmp/garrison-dock-mobile.png'});
  await touch.locator('.dock-remove').first().tap();
  assert.equal(await touch.locator('.dock-member').count(),8);
  assert.equal(await touch.locator('#overlay').isVisible(),false);
  await touchContext.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: roster hover state, click details, × removal and persistence, active and incomplete core/additional bonds, aligned counts/thresholds, ninth-slot checkbox, 独行/调和/绝技 rules, immediate updates, nine-slot responsive layout, touch removal.');
} finally {
  await browser.close();
}
