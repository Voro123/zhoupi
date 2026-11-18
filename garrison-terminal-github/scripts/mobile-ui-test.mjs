import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const executable=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/home/Voro/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const browser=await chromium.launch({headless:true,...(fs.existsSync(executable)?{executablePath:executable}:{}),args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
const data=JSON.parse(fs.readFileSync('dist/data.json','utf8'));
const cdp=await context.newCDPSession(page);
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('garrison-nexus-v1')));
async function hold(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box=await locator.boundingBox(),point={x:box.x+box.width/2,y:box.y+box.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await page.waitForTimeout(490);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(220);
}
async function closeDrawer() {
  await page.locator('#detail-panel [data-action=close]').tap();
  assert.equal(await page.locator('#overlay').isVisible(),false);
}
async function fits(width,height=844) {
  await page.setViewportSize({width,height});
  const layout=await page.evaluate(()=>{
    const dock=document.querySelector('#squad-dock'),rect=dock.getBoundingClientRect();
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dock:rect.toJSON(),slots:[...dock.querySelectorAll('.dock-slot')].map(el=>el.getBoundingClientRect().toJSON())};
  });
  assert.equal(layout.scrollWidth,layout.width,`No horizontal page overflow at ${width}×${height}`);
  assert.ok(layout.dock.left>=0&&layout.dock.right<=width+1);
  assert.ok(layout.slots.every(slot=>slot.left>=layout.dock.left&&slot.right<=layout.dock.right&&slot.top>=layout.dock.top&&slot.bottom<=layout.dock.bottom),'Nine slots fit inside the dock');
  assert.equal(await page.locator('.hero').isVisible(),false,'Mobile always keeps the focus layout');
}
try {
  await page.goto('http://localhost:4173');await page.waitForSelector('.tile-portrait');
  assert.equal((await saved()).focus,true,'New mobile sessions default to focus');
  const tile=page.locator('.tile-portrait').first(),id=await tile.getAttribute('data-add');
  await tile.tap();assert.equal((await saved()).squad.length,1);
  const toast=await page.locator('#toast').boundingBox();assert.ok(toast.height<80,'Feedback stays a compact toast');
  assert.equal(await page.locator('#overlay').isVisible(),false,'Tap selects in the list');
  await tile.tap();assert.equal((await saved()).squad.length,0,'Tap also deselects');
  const hash=await page.evaluate(()=>location.hash);
  await hold(tile);
  assert.equal(await page.locator('#overlay').isVisible(),true,'A real held touch opens the drawer');
  assert.equal((await saved()).squad.length,0,'Release after long press never selects');
  assert.equal(await page.evaluate(()=>location.hash),hash,'No route change for details');
  assert.equal(await page.locator('.app-shell').evaluate(el=>el.inert),true);
  const drawer=await page.locator('#detail-panel').boundingBox();
  assert.ok(drawer.x>=30&&Math.abs(drawer.x+drawer.width-390)<1,'Drawer leaves the list visible on its left');
  const bondImages=await page.locator('.detail-hero .bond-icon img').evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,position:getComputedStyle(el).position})));
  assert.ok(bondImages.every(img=>img.width<=28&&img.position==='static'),'Bond icons stay inside the compact header');
  await page.locator('[data-detail-state=elite]').tap();
  assert.equal(await page.locator('[data-detail-state=elite]').getAttribute('class'),'active');
  const operator=data.operators.find(o=>o.chessId===id);
  assert.equal(await page.locator('.trait-box').textContent(),operator.elite.trait);
  await page.locator('#detail-panel').evaluate(el=>el.scrollTop=250);
  const closeBox=await page.locator('#detail-panel [data-action=close]').boundingBox();
  assert.ok(closeBox.y>=0&&closeBox.y<60,'Close control stays available while reading');
  await closeDrawer();
  assert.equal(await page.locator('.app-shell').evaluate(el=>el.inert),false);

  // A swipe begins on a portrait, moves before the hold threshold, then stays held.
  await tile.scrollIntoViewIfNeeded();
  let box=await tile.boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+20,y:box.y+30}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+20,y:box.y-80}]});
  await page.waitForTimeout(550);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.locator('#overlay').isVisible(),false,'Scrolling cancels long press');
  assert.equal((await saved()).squad.length,0,'Scrolling does not select');

  // Opening and closing away from the top must preserve scroll and loaded results.
  await page.evaluate(()=>window.scrollTo(0,650));
  const visible=await page.locator('.tile-portrait').evaluateAll(els=>els.findIndex(el=>{const r=el.getBoundingClientRect();return r.top>70&&r.bottom<600;}));
  const target=page.locator('.tile-portrait').nth(visible);
  await target.scrollIntoViewIfNeeded();
  const before=await page.evaluate(()=>({y:scrollY,count:document.querySelectorAll('.op-card').length}));
  await hold(target);await closeDrawer();
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before.y)<=1,'Drawer close restores the exact scroll position');
  assert.equal(await page.locator('.op-card').count(),before.count,'Opening details keeps the loaded grid');

  await page.evaluate(()=>window.scrollTo(0,0));
  await page.locator('#filter-toggle').tap();
  assert.equal(await page.locator('#filter-toggle').getAttribute('aria-expanded'),'true');
  await page.locator('#filters [data-filter-bond=ursusShip]').tap();
  assert.equal(await page.locator('#filter-toggle').getAttribute('aria-expanded'),'true','Changing a filter keeps controls open');
  await page.locator('.mobile-filter-heading [data-action=filters]').tap();
  assert.equal(await page.locator('#filters').isVisible(),false);
  assert.equal(await page.locator('.filter-chip[data-filter-bond=ursusShip]').count(),1);
  await page.locator('.filter-chip[data-filter-bond=ursusShip]').tap();
  await page.locator('[data-quick-state=elite]').tap();
  await hold(page.locator('.tile-portrait').first());
  assert.equal(await page.locator('[data-detail-state=elite]').getAttribute('class'),'active','Quick training state carries into the drawer');
  await closeDrawer();
  await page.locator('[data-quick-state=normal]').tap();

  // Explicit card layout has the same tap/hold behavior on touch devices.
  await page.locator('[data-action=grid]').tap();
  await page.locator('.card-open').first().tap();
  assert.equal((await saved()).squad.length,1);
  assert.equal(await page.locator('#overlay').isVisible(),false);
  await hold(page.locator('.card-open').first());
  assert.equal(await page.locator('#overlay').isVisible(),true);
  assert.equal((await saved()).squad.length,1);await closeDrawer();
  await page.locator('[data-action=list]').tap();

  // Dock details use each member's stored training state.
  await page.evaluate(value=>localStorage.setItem('garrison-nexus-v1',JSON.stringify(value)),{focus:false,capacity:9,squad:data.operators.slice(0,9).map(o=>({chessId:o.chessId,elite:true}))});
  await page.reload();await page.waitForSelector('.dock-member');
  assert.equal(await page.locator('.hero').isVisible(),false,'Existing desktop focus=false does not expand mobile chrome');
  await hold(page.locator('.dock-slot.filled').first());
  assert.equal(await page.locator('[data-detail-state=elite]').getAttribute('class'),'active');
  await closeDrawer();
  for(const width of [320,360,390,600,768]) {
    await fits(width);
    assert.equal(await page.locator('.dock-slot').count(),9);
    await page.locator('.tile-portrait').first().dispatchEvent('contextmenu');
    await page.waitForTimeout(230);
    const rect=await page.locator('#detail-panel').boundingBox();
    assert.ok(rect.x>=30&&rect.x+rect.width<=width+1);
    assert.equal(await page.locator('#detail-panel').evaluate(el=>el.scrollWidth<=el.clientWidth),true,`Drawer content fits ${width}px`);
    await closeDrawer();
  }
  await fits(780,390);
  await page.setViewportSize({width:390,height:844});
  await page.locator('.dock-remove').first().tap();
  assert.equal((await saved()).squad.length,8,'Touch removal remains available');
  await page.screenshot({path:'/tmp/garrison-mobile-final.png'});
  await hold(page.locator('.tile-portrait').first());
  await page.screenshot({path:'/tmp/garrison-mobile-drawer-final.png'});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#overlay').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: real touch tap/long press, release suppression, swipe cancellation, persistent focus, scroll restoration, compact drawer with sticky close, quick training, collapsible filters, touch card selection, stored dock state, nine slots, portrait/landscape and 320–768px overflow checks.');
} finally {await browser.close();}
