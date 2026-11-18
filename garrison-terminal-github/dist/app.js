import {purchasePrice, banReason} from './catalog-rules.js';
import {ROLE_DEFINITIONS, STACK_KINDS, classifyOperator} from './operator-roles.js';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roman = ['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'];
const colors = ['','#8b9b93','#99b785','#7faebb','#a295cd','#d3ae70','#dfbd7a'];
const PAGE_SIZE = 64;
const readStore = (k, fallback) => {try {return JSON.parse(localStorage.getItem(k)) ?? fallback;} catch {return fallback;}};
let data, artwork, ops, bonds, byChess, byBond;
let loadObserver, loadingMore=false;
let saved = readStore('garrison-nexus-v1', {});
let state = {stacks:0,pool:'fixed',customTier:5,view:'operators',banOpen:false,banned:new Set(Array.isArray(saved.banned)?saved.banned:[]), query:'', roles:new Set(),roleMatch:'any',stackKind:'',bonds:new Set(),tiers:new Set(),profession:'',trait:'',match:'all',elite:false,favorites:false,compact:saved.layoutVersion===2?saved.compact!==false:true,focus:!!saved.focus,limit:PAGE_SIZE,equipmentTab:'equipment'};
let favorites = new Set(Array.isArray(saved.favorites) ? saved.favorites : []);
const PRESET_KEY='garrison-nexus-presets-v1';
let presets=[],presetQuery='',presetLimit=12;
let squad = [],capacity = saved.capacity === 9 ? 9 : 8,comparison = [];
let detail = {chess:null,variant:'main',elite:false,skill:0};
let modalReturnFocus,toastTimer,searchTimer;
function persist() {
  try { localStorage.setItem('garrison-nexus-v1', JSON.stringify({favorites:[...favorites],squad,capacity,compact:state.compact,focus:state.focus,layoutVersion:2,banned:[...state.banned]})); }
  catch { toast('浏览器存储不可用；本次操作仍有效，关闭页面后将不保留。'); }
}
function toast(message) {const t=$('#toast');t.classList.remove('undo');t.onclick=null;t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800);}
function opState(o, elite=state.elite) {return o[elite?'elite':'normal'];}
function priceBadge(o, elite=state.elite) {
 const price=purchasePrice(o,data.rules.training,elite);
 return `<span class="purchase-price" aria-label="${price===null?'特殊获取':`购买价格 ${price} 资金`}"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1ZM6 6h4v4H6Z"/><path class="coin-glint" d="M3.2 7A5 5 0 0 1 8 3"/></svg>${price??'—'}</span>`;
}
function isBanned(o) {return !!banReason(o,state.banned,byBond);}
function renderBanControls() {
 const el=$('#ban-controls');el.hidden=state.view!=='operators';if(el.hidden)return;
 const available=poolOps().filter(o=>!isBanned(o)).length;
 const selectedBonds=bonds.filter(b=>state.banned.has(b.bondId));
 const button=b=>`<button class="ban-choice ${state.banned.has(b.bondId)?'banned':''}" data-ban="${b.bondId}" aria-label="${esc(b.name)}：${state.banned.has(b.bondId)?'已禁用，点击恢复':'可用，点击禁用'}" aria-pressed="${state.banned.has(b.bondId)}">${bondImage(b.bondId)}<span>${esc(b.name)}</span><b aria-hidden="true">${state.banned.has(b.bondId)?'×':'✓'}</b></button>`;
 el.innerHTML=`<div class="ban-toolbar"><button class="ban-toggle ${selectedBonds.length?'active':''}" data-action="ban-toggle" aria-expanded="${state.banOpen}" aria-controls="ban-panel"><span aria-hidden="true">⊘</span> 本局 BAN <b>${selectedBonds.length||'设置'}</b><small>${state.banOpen?'收起 ▴':'展开 ▾'}</small></button><span class="ban-status">${selectedBonds.length?`已隐藏 <b>${poolOps().length-available}</b> 名 · 可参考 <b>${available}</b> 名`:'按开局简报设置禁用盟约'}</span>${selectedBonds.length?'<button class="ban-clear" data-action="ban-clear">新一局 · 清空</button>':''}</div>${!state.banOpen&&selectedBonds.length?`<div class="ban-summary">${selectedBonds.map(b=>`<button data-ban="${b.bondId}" aria-label="恢复${esc(b.name)}">${bondImage(b.bondId)}<span>${esc(b.name)}</span> ×</button>`).join('')}</div>`:''}<div id="ban-panel" class="ban-panel" ${state.banOpen?'':'hidden'}><p class="ban-caption">勾选游戏简报中已置灰的盟约，干员列表即时更新。</p><h3>核心盟约 <small>阵营</small></h3><div class="ban-grid">${bonds.filter(b=>b.core).map(button).join('')}</div><h3>附加盟约</h3><div class="ban-grid">${bonds.filter(b=>!b.core).map(button).join('')}</div><details class="ban-rules"><summary>筛选规则与来源</summary><p>核心盟约被禁用时，所属干员退出卡池；附加盟约需该干员所拥有的附加盟约全部禁用才退出。多核心干员任一核心被禁用即隐藏，自选候选同样按所属盟约处理。绝技只影响盟约效果，不用于排除干员。按干员初始归属判断，切换精锐不会改变 BAN 结果。</p><p>游戏在开局给出盟约随机结果，这里用于记录本局结果。已保存的阵容和预设会保留。</p><a href="https://prts.wiki/w/卫戍协议·规程/战场一览" target="_blank" rel="noopener">本期游戏教程 · PRTS 收录 ↗</a></details></div>`;
}
function changeBan(id) {
 if(!byBond.has(id))return;
 state.banned.has(id)?state.banned.delete(id):state.banned.add(id);state.limit=PAGE_SIZE;persist();render();
 if(state.banOpen)$(`[data-ban="${id}"]`,$('#ban-panel'))?.focus({preventScroll:true});
}
function selected(o) {return squad.some(s=>s.chessId===o.chessId);}
function bondImage(id, className='') {const b=byBond.get(id);return `<img class="${className}" src="${artwork.bonds[id].image}" alt="${esc(b?.name)}" loading="lazy">`;}
function bondTags(o, elite=state.elite, hover=true) {return opState(o,elite).bonds.map(id=>`<button class="bond-tag bond-icon ${state.banned.has(id)?'is-banned':''} ${byBond.get(id)?.core?'core':''}" data-bond="${id}" ${hover?`data-bond-tip="${id}"`:""} aria-label="${esc(byBond.get(id)?.name)}${state.banned.has(id)?'（本局禁用）':''}：${hover?"悬浮查看效果，":""}点击筛选">${bondImage(id)}</button>`).join('');}

function searchable(o) {return [o.name,o.english,o.profession,o.branch,o.normal.trait,o.elite.trait,...new Set([...o.normal.bonds,...o.elite.bonds].map(id=>byBond.get(id)?.name)),...o.normal.skills.map(s=>s.name+' '+s.description),...o.elite.skills.map(s=>s.description),o.backup?.name,o.backup?.english].join(' ').toLowerCase();}
function matchesQuery(text) {return state.query.trim().toLowerCase().split(/\s+/).every(q=>text.includes(q));}
function poolOps() {return state.pool==='custom'?data.customOperators.filter(o=>o.tier===state.customTier):ops;}
function identityLabel(id) {return ROLE_DEFINITIONS.find(r=>r.id===id)?.label||'未标记';}
function identities(o,elite=state.elite) {return classifyOperator(o,elite);}
function identityMatches(o) {
 const roles=identities(o);
 if(state.stackKind&&!roles.some(r=>r.id==='stack'&&r.kind===state.stackKind))return false;
 if(!state.roles.size)return true;
 if(state.roles.has('none'))return roles.length===0;
 return state.roleMatch==='all'?[...state.roles].every(id=>roles.some(r=>r.id===id)):[...state.roles].some(id=>roles.some(r=>r.id===id));
}
function identityClass(o,elite=state.elite) {return identities(o,elite).map(r=>'identity-'+r.id+(r.conditional?' identity-'+r.id+'-conditional':'')).join(' ');}
function identityBadges(o,elite=state.elite) {return identities(o,elite).map(r=>`<span class="identity-badge identity-badge-${r.id} ${r.conditional?'conditional':''}" aria-hidden="true">${r.id==='stack'?'叠':'经'}${r.conditional?'*':''}</span>`).join('');}
function identityChips(o,elite=state.elite) {return identities(o,elite).map(r=>`<span class="identity-chip identity-chip-${r.id}">${identityLabel(r.id)}${r.conditional?'*':''}</span>`).join('');}
function renderIdentityControls() {
 const el=$('#identity-controls');el.hidden=state.view!=='operators';if(el.hidden)return;
 const pool=poolOps().filter(o=>!isBanned(o)),count=id=>pool.filter(o=>id==='none'?identities(o).length===0:identities(o).some(r=>r.id===id)).length;
 el.innerHTML=`<div class="identity-shortcuts"><span class="identity-title">用途筛选</span>${ROLE_DEFINITIONS.map(r=>`<button data-identity="${r.id}" class="identity-filter identity-filter-${r.id} ${state.roles.has(r.id)?'active':''}" aria-pressed="${state.roles.has(r.id)}"><span>${r.symbol}</span> ${r.label}<b>${count(r.id)}</b></button>`).join('')}<button data-identity="none" class="identity-filter ${state.roles.has('none')?'active':''}" aria-pressed="${state.roles.has('none')}">未标记<b>${count('none')}</b></button></div><div class="identity-options"><select id="identity-match" aria-label="身份标签匹配方式"><option value="any" ${state.roleMatch==='any'?'selected':''}>符合任一身份</option><option value="all" ${state.roleMatch==='all'?'selected':''}>同时具备所选身份</option></select><select id="stack-kind" aria-label="叠层类型"><option value="">全部叠层类型</option>${STACK_KINDS.map(k=>`<option value="${k.id}" ${state.stackKind===k.id?'selected':''}>${k.label}</option>`).join('')}</select></div>`;
}
function currentOps() {
  return poolOps().filter(o=>!isBanned(o) && identityMatches(o) && matchesQuery(o.searchText) && (!state.favorites || favorites.has(o.chessId)) && (!state.profession || o.profession===state.profession) && (!state.trait || opState(o).traitType===state.trait) && (!state.tiers.size || state.tiers.has(o.tier)) && (!state.bonds.size || (state.match==='all' ? [...state.bonds].every(id=>opState(o).bonds.includes(id)) : [...state.bonds].some(id=>opState(o).bonds.includes(id))))).sort((a,b)=>{
    const mode=$('#sort').value;
    const tierOrder=mode==='tier-desc'?b.tier-a.tier:a.tier-b.tier;if(tierOrder)return tierOrder;
    if(mode==='name')return a.name.localeCompare(b.name,'zh-CN');
    if(mode==='sp')return opState(a).skills[a.defaultSkill].sp.spCost-opState(b).skills[b.defaultSkill].sp.spCost || b.tier-a.tier;
    return (mode==='tier-asc'?a.tier-b.tier:b.tier-a.tier) || a.order-b.order;
  });
}
function resetFilters() {state.roles.clear();state.stackKind='';state.bonds.clear();state.tiers.clear();state.profession='';state.trait='';state.query='';state.favorites=false;state.limit=PAGE_SIZE;$('#search').value='';}
function switchView(view, keepQuery=false) {
  if(!['operators','equipment','squad'].includes(view))view='operators';
  state.view=view;state.limit=PAGE_SIZE;
  if(!keepQuery){state.query='';$('#search').value='';}
  const names={operators:['01 / OPERATOR ARCHIVE','干员档案'],equipment:['02 / FIELD REFERENCE','战备资料'],squad:['03 / ROSTER PLANNING','阵容规划']};
  $('#section-index').textContent=names[view][0];$('#page-title').innerHTML=names[view][1]+'<span> /</span>';
  $$('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===view));
  $('#search').placeholder={operators:'搜索干员、盟约、技能或特质关键词…',equipment:'搜索装备、策略或效果关键词…',squad:'搜索阵容中的干员…'}[view];
  $('#sort').parentElement.hidden=view!=='operators';
  $('#favorites-button').hidden=view!=='operators';
  $('#filter-toggle').hidden=view==='squad';
  document.body.classList.toggle('compact',state.compact && view==='operators');
  history.replaceState(null,'','#'+view);render();
}
function renderFilters() {
 const f=$('#filters');
 if(state.view==='squad') {f.innerHTML=`<div class="filter-group"><div class="filter-title">本局草案<small>LOCAL ONLY</small></div><p class="small-note">阵容保存在当前浏览器。可以导出 JSON 备份，在另一台设备导入。</p></div><div class="filter-group"><div class="filter-title">部署人数</div><label class="check-label"><input id="capacity" type="checkbox" ${capacity===9?'checked':''}> 人事部文档（上限 9 人）</label><p class="small-note">请仅在本局持有对应装备时启用。</p></div><button class="reset-button" data-nav="operators">＋ 前往干员档案</button>`;return;}
 if(state.view==='equipment') {f.innerHTML=`<div class="filter-group"><div class="filter-title">战备分类<small>REFERENCE</small></div><button class="faction-filter ${state.equipmentTab==='equipment'?'active':''}" data-equipment-tab="equipment"><span class="faction-mark">◇</span>装备档案<small>${data.equipment.length}</small></button><button class="faction-filter ${state.equipmentTab==='strategy'?'active':''}" data-equipment-tab="strategy"><span class="faction-mark">⌁</span>角色策略<small>${data.strategies.length}</small></button></div><p class="small-note">装备显示初始与进阶效果。策略保留初始目标生命值、效果与解锁条件。</p>`;return;}
 const poolNote=state.pool==='custom'?'<div class="notice">自选干员无驻守特质。卡片先展示最高序号技能，可在详情中查询各技能。盟约按客户端势力字段匹配，选择以局内为准。</div>':'';
 const fbutton=b=>`<button class="faction-filter ${state.bonds.has(b.bondId)?'active':''}" data-filter-bond="${b.bondId}" data-bond-tip="${b.bondId}" aria-pressed="${state.bonds.has(b.bondId)}"><span class="faction-mark">${bondImage(b.bondId)}</span>${esc(b.name)}<small>${poolOps().filter(o=>!isBanned(o)&&opState(o).bonds.includes(b.bondId)).length.toString().padStart(2,'0')}</small></button>`;
 f.innerHTML=poolNote+`<div class="filter-group"><div class="filter-title">盟约筛选 <button data-action="reset">重置 ↺</button></div><select id="match-mode" class="filter-select" aria-label="盟约匹配方式"><option value="all" ${state.match==='all'?'selected':''}>同时具备所选盟约</option><option value="any" ${state.match==='any'?'selected':''}>具备任一所选盟约</option></select><div class="filter-subtitle">核心盟约 / CORE</div><div class="filter-factions">${bonds.filter(b=>b.core).map(fbutton).join('')}</div><div class="filter-subtitle">独立盟约 / INDEPENDENT</div><div class="filter-factions">${bonds.filter(b=>!b.core).map(fbutton).join('')}</div></div>${state.view==='operators'?`<div class="filter-group"><div class="filter-title">干员等阶<small>TIER</small></div><div class="tier-buttons">${[1,2,3,4,5,6].map(n=>`<button data-tier="${n}" class="${state.tiers.has(n)?'active':''}" aria-label="${n}阶" aria-pressed="${state.tiers.has(n)}">${roman[n]}</button>`).join('')}</div></div><div class="filter-group"><div class="filter-title">养成状态<small>TRAINING</small></div><div class="state-switch"><button data-state="normal" class="${!state.elite?'active':''}">初始状态</button><button data-state="elite" class="${state.elite?'active':''}">精锐状态</button></div><p class="small-note">技能 ${state.elite?'7':'4'} 级 · 数值随状态切换</p></div><div class="filter-group"><div class="filter-title">职业 / 特质<small>CLASS</small></div><select id="profession-filter" class="filter-select" aria-label="职业筛选"><option value="">全部职业</option>${[...new Set(ops.map(o=>o.profession))].map(p=>`<option ${state.profession===p?'selected':''}>${p}</option>`).join('')}</select><select id="trait-filter" class="filter-select" aria-label="驻守特质筛选" style="margin-top:8px"><option value="">全部驻守特质</option>${[...new Set(ops.map(o=>opState(o).traitType))].map(t=>`<option ${state.trait===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>`:''}<button class="reset-button" data-action="reset">清除全部筛选</button>`;
}
function card(o) {
 if(state.compact)return iconTile(o);
 const s=opState(o),sk=s.skills[o.defaultSkill],isSelected=selected(o);
 return `<article class="op-card ${identityClass(o)} ${isSelected?'selected':''}" style="--tier:${colors[o.tier]}" data-card="${o.chessId}"><div class="card-visual">${identityBadges(o)}${priceBadge(o)}<img class="card-portrait" loading="lazy" src="${o.portrait}" alt="${esc(o.name)}立绘"><button class="card-open" data-op-tip="${o.chessId}" data-open="${o.chessId}" aria-label="查看${esc(o.name)}详情"></button><div class="tier-label">${roman[o.tier]}<small>TIER<br>0${o.tier}</small></div><button class="card-fav ${favorites.has(o.chessId)?'saved':''}" data-fav="${o.chessId}" aria-label="${favorites.has(o.chessId)?'取消收藏':'收藏'}${esc(o.name)}" aria-pressed="${favorites.has(o.chessId)}">${favorites.has(o.chessId)?'★':'☆'}</button><div class="card-identity"><span class="profession">${esc(o.profession)} / ${esc(o.branch)} ${o.type==='DIY'?'· 自选':o.hidden?'· 特殊获取':''}</span><h3>${esc(o.name)}</h3><span class="english">${esc(o.english.toUpperCase())}</span></div></div><div class="card-body"><div class="card-bonds">${bondTags(o,state.elite,false)}</div><div class="card-trait-label">驻守特质 <span>/ ${esc(s.traitType)}</span></div><p class="card-trait" title="${esc(s.trait)}">${esc(s.trait)}</p><div class="card-sp"><span class="skill-name">S${o.defaultSkill+1} · ${esc(sk.name)}</span><span>初始 <b>${sk.sp.initSp}</b></span><i>/</i><span>所需 <b>${sk.sp.spCost}</b></span></div><div class="card-actions"><button class="detail-button" data-open="${o.chessId}">完整档案 <span>↗</span></button><button class="compare-button ${comparison.includes(o.chessId)?'active':''}" data-compare="${o.chessId}" aria-label="对比${esc(o.name)}" title="加入对比">⇄</button><button class="add-button ${isSelected?'in-squad':''}" data-add="${o.chessId}" aria-label="${isSelected?'移出阵容':'加入阵容'}${esc(o.name)}" title="${isSelected?'移出阵容':'加入阵容'}">${isSelected?'✓':'＋'}</button></div></div></article>`;
}
function iconTile(o) {
 const included=selected(o);
 return `<article class="op-card icon-tile ${identityClass(o)} ${included?'selected':''}" style="--tier:${colors[o.tier]}" data-card="${o.chessId}"><button class="tile-portrait" data-op-tip="${o.chessId}" data-add="${o.chessId}" data-context-open="${o.chessId}" aria-label="${included?'移出阵容':'加入阵容'}${esc(o.name)}${identities(o).length?"；"+identities(o).map(r=>identityLabel(r.id)+(r.conditional?"（条件）":"")).join("、"):""}；右键或长按查看详情" aria-pressed="${included}"><img src="${o.avatar}" alt="${esc(o.name)}" loading="lazy">${identityBadges(o)}${priceBadge(o)}${included?'<span class="tile-selected" aria-hidden="true">✓</span>':''}</button><div class="tile-bonds">${bondTags(o,state.elite,false)}</div></article>`;
}
function operatorGroups(items, previousTier=null) {
 const counts=new Map();for(const o of currentOps())counts.set(o.tier,(counts.get(o.tier)||0)+1);
 let html='';for(const o of items){if(o.tier!==previousTier){html+=`<h3 class="tier-divider" data-tier-group="${o.tier}" style="--tier:${colors[o.tier]}"><span>${roman[o.tier]} 阶</span><small>TIER 0${o.tier}</small><b>${counts.get(o.tier)} 名干员</b></h3>`;previousTier=o.tier;}html+=card(o);}return html;
}
function updateLoadSentinel(total) {
 loadObserver?.disconnect();const el=$('#load-more');
 if(state.view!=='operators'){el.innerHTML='';return;}
 const loaded=Math.min(state.limit,total);el.innerHTML=total?`<span>${loaded<total?'继续向下滚动，自动加载更多':'本次检索已全部显示'} <b>${loaded} / ${total}</b>${loaded<total?' ↓':''}</span>`:'';
 if(loaded<total){loadObserver??=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))loadMoreOperators();},{rootMargin:'220px 0px'});loadObserver.observe(el);}
}
function loadMoreOperators() {
 if(loadingMore||state.view!=='operators')return;
 const result=currentOps();if(state.limit>=result.length)return;
 loadingMore=true;const start=state.limit;state.limit+=PAGE_SIZE;
 $('#content').insertAdjacentHTML('beforeend',operatorGroups(result.slice(start,state.limit),result[start-1]?.tier));
 updateLoadSentinel(result.length);loadingMore=false;
}

function render() {
 if(!data)return;
 hideHover();
 $('#pool-controls').hidden=state.view!=='operators';
 $('#pool-controls').innerHTML=`<div class="pool-tabs"><button data-pool="fixed" class="${state.pool==='fixed'?'active':''}">固定干员 <b>143</b></button><button data-pool="custom" class="${state.pool==='custom'?'active':''}">自选候选 <b>75</b></button></div>${state.pool==='custom'?`<div class="pool-tiers"><span>加入等阶</span><button data-custom-tier="5" class="${state.customTier===5?'active':''}">Ⅴ 阶</button><button data-custom-tier="6" class="${state.customTier===6?'active':''}">Ⅵ 阶</button><small>每阶至多选 2 名</small></div>`:'<span class="pool-hint">含原型补位 · 按本期配置收录</span>'}`;
 renderBanControls();renderIdentityControls();renderFilters();$('#favorites-button').classList.toggle('active',state.favorites);
 $('#favorites-button').innerHTML=state.favorites?'★ 仅看收藏':'☆ 仅看收藏';
 $('#active-filters').innerHTML=state.view==='operators'?[...state.bonds].map(id=>`<button class="filter-chip" data-filter-bond="${id}">${esc(byBond.get(id)?.name)} ×</button>`).join('')+[...state.roles].map(id=>`<button class="filter-chip identity-chip-${id}" data-identity="${id}">${identityLabel(id)} ×</button>`).join('')+(state.stackKind?`<button class="filter-chip" data-action="clear-stack-kind">${STACK_KINDS.find(k=>k.id===state.stackKind)?.label} ×</button>`:''):'';
 const content=$('#content');content.className=state.view==='operators'?'operator-grid':state.view==='equipment'?'equipment-grid':'';
 $('#catalog-hint').hidden=state.view!=='operators';
 $('#catalog-hint').innerHTML=state.compact?'<span class="desktop-hint">单击头像选入／移出阵容 · 悬浮头像查看特质 · 筛选栏可查盟约效果 · 右键完整档案</span><span class="touch-hint">点按头像选入阵容 · 长按查看详情 · 点按盟约查看效果</span>':'筛选栏可查盟约效果 · 切换头像视图可快速选人';
 $('#load-more').innerHTML='';
 if(state.view==='operators') {
  const result=currentOps();$('#result-count').innerHTML=`检索到 <b>${result.length}</b> 名干员 <span class="muted">/ ${state.pool==='custom'?'自选候选 '+state.customTier+' 阶':'固定槽位 143'}</span>`;
  content.innerHTML=result.length?operatorGroups(result.slice(0,state.limit)):`<div class="empty-state"><strong>未找到符合条件的干员</strong>尝试减少盟约条件，或更换技能关键词。<br><button data-action="reset">清除筛选</button></div>`;
  updateLoadSentinel(result.length);
 } else if(state.view==='equipment')renderEquipment();
 else renderSquad();
 renderDock();
}
function squadCounts() {
 const counts={};
 for(const member of squad){const o=byChess.get(member.chessId);for(const id of opState(o,member.elite).bonds){if(byBond.get(id)?.activeConditionTemplate==='count_threshold_upward_golden'&&!member.elite)continue;counts[id]=(counts[id]||0)+1;}}
 if(counts.maniShip)for(const b of bonds)if(b.core&&counts[b.bondId])counts[b.bondId]+=1;
 return counts;
}
const formulaLabels={yanShip:[['攻击力提升',100,'%'],['敌方元素损伤恢复速度提升 · 6 人',100,'%']],sargonShip:[['攻速增益持续',1,'秒'],['流沙迟钝 · 6 人',100,'%'],['流沙每 5 秒法伤 · 6 人',1,''],['技能期流沙每秒法伤 · 6 人',1,'']],victoriaShip:[['携装伤害倍率',100,'%']],kjeragShip:[['对寒冷／冻结额外伤害倍率',100,'%']],egirShip:[['生命值提升',100,'%']],siracusaShip:[['攻击速度提升',1,''],['攻速增益持续',1,'秒'],['异常状态持续 · 6 人',1,'秒'],['每秒真实伤害 · 6 人',1,'']],kazimierzShip:[['攻击力叠加上限',100,'%']],ursusShip:[['攻击力提升',100,'%'],['生命值提升',100,'%'],['伤害转流失比例 · 6 人',100,'%'],['阻挡每秒法伤／攻击力 · 6 人',100,'%']],iberiaShip:[['每层持续法伤／攻击力',100,'%']],lethaniaShip:[['攻击力提升',100,'%'],['召唤一个乐部概率 · 6 人',100,'%']],preciShip:[['攻击力提升',100,'%']],swiftShip:[['技能结束回技力概率',100,'%']],skillfulShip:[['攻击速度提升',1,'']],steadShip:[['生命值提升',100,'%'],['反击法术伤害 · 3 人',1,'']],deputShip:[['防御力提升',100,'%']],miraShip:[['刷新免费概率',100,'%']],raidShip:[['攻击力与生命值提升',100,'%']],indomShip:[['被击倒时立即重部署概率',100,'%']],docShip:[['每秒生命治疗／攻击力',100,'%'],['每秒元素治疗／攻击力',100,'%'],['庇护比例 · 3 人',100,'%']],arcaneShip:[['额外法伤／攻击力',100,'%'],['法抗降低上限 · 3 人',1,'']]};
function bondFormulaMarkup(b) {
 const params=b.params?.descParamInfos||[],labels=formulaLabels[b.bondId];if(!params.length||!labels)return '';
 const values=new Map(b.buffs.flatMap(x=>x.blackboard).filter(v=>v.valueStr===null).map(v=>[v.key,v.value]));
 const n=v=>Number(v.toFixed(4));
 return `<div class="bond-formulas">${params.map((p,i)=>{const label=labels[i];if(!label||!values.has(p.descParamBase)||!values.has(p.descParamPerStack))return '';const [name,mul,unit]=label,base=values.get(p.descParamBase),delta=values.get(p.descParamPerStack);let value=base+delta*state.stacks;if(p.descParamMax>0)value=Math.min(value,p.descParamMax);return `<div><span>${esc(name)}</span><strong>${n(value*mul)}${unit}</strong><small>(${n(base*mul)} ${delta<0?'−':'+'} ${n(Math.abs(delta)*mul)} × ${state.stacks})${unit}${p.descParamMax>0?'，最高 '+n(p.descParamMax*mul)+unit:''}</small></div>`;}).join('')}</div>`;
}
function renderEquipment() {
 let items=state.equipmentTab==='strategy'?data.strategies.filter(s=>matchesQuery((s.bandName+' '+s.bandDesc+' '+(s.unlockDesc||'')).toLowerCase())):data.equipment.filter(e=>matchesQuery(e.variants.map(v=>v.effect.effectName+' '+v.effect.effectDesc).join(' ').toLowerCase()));
 $('#result-count').innerHTML=`检索到 <b>${items.length}</b> 项${state.equipmentTab==='strategy'?'角色策略':'战备装备'}`;
 $('#content').innerHTML=`<div class="equipment-tabs"><button data-equipment-tab="equipment" class="${state.equipmentTab==='equipment'?'active':''}">◇ 装备档案</button><button data-equipment-tab="strategy" class="${state.equipmentTab==='strategy'?'active':''}">⌁ 角色策略</button></div>`+items.map(item=>{
  if(state.equipmentTab==='strategy')return `<article class="equipment-card strategy-card"><img class="catalog-art strategy-art" src="${artwork.strategies[item.bandId].image}" alt="${esc(item.bandName)}策略发起人" loading="lazy"><small>${item.bandType==='GENERAL'?'通用策略':'盟约策略'} / 初始生命 ${item.totalHp}</small><h3>${esc(item.bandName)}</h3><p>${esc(item.bandDesc)}</p>${item.unlockDesc?`<p class="elite-effect">解锁：${esc(item.unlockDesc)}</p>`:''}</article>`;
  const a=item.variants[0],b=item.variants[1];return `<article class="equipment-card"><img class="catalog-art equipment-art" src="${artwork.equipment[item.itemId].image}" alt="${esc(a?.effect.effectName)}装备图标" loading="lazy"><small>${roman[item.itemLevel]||'特殊'} 阶装备 ${a?.purchasePrice?' / 购买 '+a.purchasePrice+' 资金':''}</small><h3>${esc(a?.effect.effectName||item.itemId)}</h3><p>${esc(a?.effect.effectDesc)}</p>${b?`<p class="elite-effect">进阶效果<br>${esc(b.effect.effectDesc)}</p>`:''}${a?.fuseWith?`<p class="training-note">合成：${esc(equipmentName(a.fuseWith))} → ${esc(equipmentName(a.fuseResult))}</p>`:''}<details class="raw-details"><summary>原始参数与合成配置</summary><pre>${esc(JSON.stringify(item,null,2))}</pre></details></article>`;
 }).join('')+(items.length?'':`<div class="empty-state"><strong>没有匹配的战备资料</strong></div>`);
}
function equipmentName(id) {for(const e of data.equipment)for(const v of e.variants)if(v.chessId===id)return v.effect.effectName;return id;}
function bondReached(b,count=0) {return count>0&&(b.activeConditionTemplate==='count_threshold_downward'?count===b.activeCount:count>=b.activeCount);}
function renderDock() {
 const counts=squadCounts(),activeBonds=bonds.filter(b=>bondReached(b,counts[b.bondId]));
 $('#squad-dock').innerHTML=`<div class="dock-heading"><small>MY ROSTER</small><strong>本局阵容</strong><span class="count-line"><b>${squad.length}</b><em> / ${capacity}</em></span></div><div class="dock-slots">${Array.from({length:capacity},(_,i)=>{const m=squad[i],o=m?byChess.get(m.chessId):null;return o?`<div class="dock-member" data-op-tip="${o.chessId}" data-op-elite="${m.elite}"><button class="dock-slot filled" data-open="${o.chessId}" data-open-elite="${m.elite}" aria-label="查看${esc(o.name)} · ${m.elite?'精锐':'初始'}详情"><img src="${o.avatar}" alt="${esc(o.name)}"><small>${roman[o.tier]}</small></button><button class="dock-remove" data-add="${o.chessId}" aria-label="移除${esc(o.name)}">×</button></div>`:`<button class="dock-slot" data-nav="operators" aria-label="添加第${i+1}名干员">＋</button>`;}).join('')}</div><div class="dock-actions"><button class="dock-clear" data-action="clear-squad" aria-label="清空本局阵容" ${squad.length?'':'disabled'}>清空</button><button class="dock-open" data-nav="squad">阵容<span class="extra">规划</span> ↗</button></div><div class="dock-bonds" aria-label="已达成盟约"><span class="dock-bonds-label">已达成盟约</span>${activeBonds.map(b=>`<button class="dock-bond ${b.core?'core':''}" data-bond-detail="${b.bondId}" data-bond-tip="${b.bondId}" aria-label="${esc(b.name)} · ${counts[b.bondId]} 人，查看盟约详情">${bondImage(b.bondId)}<span>${esc(b.name)}</span><b>${counts[b.bondId]}</b></button>`).join('')||'<span class="dock-bonds-empty">暂无达成的盟约</span>'}</div>`;
 const dock=$('#compare-dock');dock.hidden=comparison.length===0;
 dock.innerHTML=comparison.length?`<span>对比 ${comparison.length}/2 · ${comparison.map(id=>esc(byChess.get(id).name)).join(' / ')}</span><button data-action="compare-open" ${comparison.length<2?'disabled':''}>开始对照 ↗</button><button data-action="compare-clear" aria-label="清空对比">×</button>`:'';
}
function squadMarkup() {
 const counts=squadCounts();const q=state.query.toLowerCase();const members=squad.filter(m=>matchesQuery(byChess.get(m.chessId).searchText));
 return `<div class="squad-page"><div class="notice">草案自动保存于本机。人数进度用于规划，已计入调和对现有核心盟约的 +1 人，绝技只计精锐，独行要求恰好 1 人。站位、备战区及其他效果仍需结合说明判断。这里不模拟战斗、装备转职或实际叠层。</div><div class="squad-intro"><div><h3>当前阵容 <span class="muted">${squad.length} / ${capacity}</span></h3><small>规程 · 序列Ⅰ / 本机保存</small></div><div class="squad-actions"><button data-action="export">导出</button><button data-action="import">导入</button><button data-action="clear-squad">清空</button></div></div>${presetLibraryMarkup()}<input type="file" id="squad-import" class="squad-import" accept="application/json,.json">${members.length?members.map(m=>{const o=byChess.get(m.chessId);return `<div class="squad-row"><button data-op-tip="${o.chessId}" data-op-elite="${m.elite}" data-open="${o.chessId}" data-open-elite="${m.elite}" aria-label="查看${esc(o.name)}详情"><img src="${o.avatar}" alt="${esc(o.name)}"></button><div class="squad-name"><button data-open="${o.chessId}" data-open-elite="${m.elite}">${esc(o.name)}</button><small>${roman[o.tier]} 阶 / ${opState(o,m.elite).bonds.map(id=>esc(byBond.get(id)?.name)).join(' · ')}</small></div><div class="state-switch"><button class="${!m.elite?'active':''}" data-member-state="${m.chessId}" data-value="normal">初始</button><button class="${m.elite?'active':''}" data-member-state="${m.chessId}" data-value="elite">精锐</button></div><button class="remove-button" data-add="${o.chessId}" aria-label="移除${esc(o.name)}">×</button></div>`;}).join(''):`<div class="empty-state"><strong>${squad.length?'没有匹配的阵容成员':'部署从一份草案开始'}</strong>${squad.length?'清空搜索即可查看全部成员。':'单击干员头像，把想尝试的干员加入这里。'}<br><button data-nav="operators">前往干员档案 ↗</button></div>`}<div class="squad-bonds"><h3>盟约人数进度 <span class="muted" style="font-size:10px">/ ${capacity===9?'9 人上限':'8 人上限'}</span></h3>${bonds.filter(b=>counts[b.bondId]).sort((a,b)=>(b.core-a.core)||counts[b.bondId]-counts[a.bondId]).map(b=>{const count=counts[b.bondId],reached=bondReached(b,count);return `<button class="squad-bond-row ${reached?'active':''}" style="width:100%;text-align:left" data-bond-detail="${b.bondId}" data-bond-tip="${b.bondId}"><strong>${bondImage(b.bondId)} ${esc(b.name)}</strong><div class="progress-track"><span style="width:${Math.min(100,count/b.activeCount*100)}%"></span></div><b>${count} / ${b.activeCount}</b><span>${reached?'达起始人数':b.activeConditionTemplate==='count_threshold_downward'?'需恰好 1 人':'差 '+(b.activeCount-count)+' 人'} ↗</span></button>`;}).join('')||'<p class="small-note">加入干员后，这里会显示对应盟约的人数进度。</p>'}</div><div class="detail-section"><h3>自选编队</h3><p class="small-note">本期收录固定池外 75 名六星自选候选（含原型），可从干员档案的“自选候选”入口选择Ⅴ／Ⅵ阶。游戏内每阶最多选 2 名加入本局；自选干员没有专属驻守特质。</p><label class="check-label"><input id="capacity-page" type="checkbox" ${capacity===9?'checked':''}> 本局持有人事部文档，启用 9 人上限</label></div></div>`;
}
function renderSquad() {$('#result-count').innerHTML=`当前草案 <b>${squad.length}</b> 名干员 <span class="muted">/ 已自动保存至本机</span>`;$('#content').innerHTML=squadMarkup();}
function addToSquad(id) {
 const i=squad.findIndex(m=>m.chessId===id),o=byChess.get(id);if(!o)return;
 if(i>=0){squad.splice(i,1);toast(o.name+' 已移出阵容');}
 else {if(squad.some(m=>byChess.get(m.chessId).id===o.id)){toast('同一干员已在阵容中，不能跨等阶重复加入。');return;}if(o.type==='DIY'&&squad.filter(m=>{const p=byChess.get(m.chessId);return p.type==='DIY'&&p.tier===o.tier;}).length>=2){toast('自选编队每阶最多 2 名。');return;}if(squad.length>=capacity){toast('阵容已满，请先移除一名干员。');return;}squad.push({chessId:id,elite:state.elite});toast(o.name+' 已加入阵容');}
 persist();
 if(state.view==='operators'){$$(`[data-card="${id}"]`).forEach(el=>{if(el.classList.contains('icon-tile')){const included=selected(o),button=$('.tile-portrait',el);el.classList.toggle('selected',included);button.setAttribute('aria-pressed',String(included));button.setAttribute('aria-label',(included?'移出阵容':'加入阵容')+o.name+'；右键或长按查看详情');$('.tile-selected',el)?.remove();if(included)button.insertAdjacentHTML('beforeend','<span class="tile-selected" aria-hidden="true">✓</span>');}else el.outerHTML=card(o);});renderDock();hideHover();}else render();
 if(detail.chess===id&&!$('#overlay').hidden)renderDetail();
}
function compareToggle(id) {if(comparison.includes(id))comparison=comparison.filter(x=>x!==id);else if(comparison.length<2)comparison.push(id);else {toast('最多同时对照 2 名干员，请先取消一个。');return;}render();if(detail.chess&&!$('#overlay').hidden)renderDetail();}
function showModal(html, wide=false) {hideHover();const overlay=$('#overlay'),panel=$('#detail-panel');if(overlay.hidden)modalReturnFocus=document.activeElement;panel.classList.toggle('wide',wide);panel.innerHTML=html;overlay.hidden=false;document.body.style.overflow='hidden';panel.focus();}
function closeModal() {$('#overlay').hidden=true;document.body.style.overflow='';detail.chess=null;if(modalReturnFocus?.isConnected)modalReturnFocus.focus();}
function modalHeader(label) {return `<div class="modal-topbar"><span>${label}</span><button class="close-button" data-action="close" aria-label="关闭详情">×</button></div>`;}
function openDetail(id,elite=state.elite) {const o=byChess.get(id);if(!o)return;detail={chess:id,variant:'main',elite,skill:o.defaultSkill};renderDetail();$('#detail-panel').scrollTop=0;}
const spType={INCREASE_WITH_TIME:'自动回复',INCREASE_WHEN_ATTACK:'攻击回复',INCREASE_WHEN_TAKEN_DAMAGE:'受击回复',INCREASE_WITH_TIME_AND_ATTACK:'自动与攻击回复',NONE:'不回复'};
function skillStats(sk) {return `<div class="skill-stats"><div><b>${sk.sp.initSp}</b><span>初始技力</span></div><div><b>${sk.sp.spCost}</b><span>所需技力</span></div><div><b>${sk.duration<0?'∞':sk.duration===0?'—':sk.duration+'s'}</b><span>技能持续</span></div><div><b>${sk.sp.maxChargeTime||1}</b><span>最大充能次数</span></div></div>`;}
const triggerText={ALWAYS:'持续尝试施放',ON_TAKE_DAMAGE:'受到伤害时',SKILL_RANGE_ENEMY:'技能范围内有敌人',ATTACK_RANGE_ENEMY:'攻击范围内有敌人',ATTACK_RANGE_ALLY:'攻击范围内有可治疗单位',SKILL_RANGE_ALLY:'技能范围内有可治疗单位',COMBAT_OR_ATTACK:'可进行攻击时',CUSTOM_RANGE_ENEMY:'特定范围内有敌人',GLOBAL_RANGE_ENEMY:'己方场地内有敌人',INVALID_IN_SKILL:'技能特定状态限制',MLYSS_S:'缪尔赛思专用方案（具体条件未公开，保留配置值 MLYSS_S）',MARCIL_S2:'玛露希尔专用魔力判断与二次施放方案'};
function skillMarkup(sk) {return `<div class="skill-heading"><strong>${esc(sk.name)}</strong><small>${esc(spType[sk.sp.spType]||sk.sp.spType)} · ${{MANUAL:'手动触发 → 协议自动施放',AUTO:'自动触发',PASSIVE:'被动技能'}[sk.type]||esc(sk.type)}</small></div>${!sk.available?'<p class="notice">本状态尚未解锁该技能；以下展示同等级参数供查询。</p>':''}${skillStats(sk)}<p class="skill-description">${esc(sk.description)}</p><div class="trigger-note">${sk.type==='PASSIVE'?'被动技能，无需主动施放。':sk.type==='AUTO'?'满足自身触发条件时自动触发。':'协议施放条件：'+(sk.trigger.length?sk.trigger.map(t=>esc(triggerText[t]||t)).join('；'):'基础方案：可攻击时，或攻击／技能范围内有敌人。')}<br>标注技力为原始基础值；天赋、模组、盟约和装备可影响实际回复与初始技力。</div><details class="raw-details"><summary>查看技能原始技力与数值参数</summary><pre>${esc(JSON.stringify({skillId:sk.id,level:sk.level,sp:sk.sp,duration:sk.duration,durationType:sk.durationType,blackboard:sk.blackboard,autoTrigger:sk.trigger},null,2))}</pre></details>`;}
function rangeMarkup(range) {const coords=new Set((range?.grids||[]).map(g=>g.row+','+g.col));return `<div class="range" aria-label="范围示意，白色为自身位置">${Array.from({length:49},(_,i)=>{let row=Math.floor(i/7)-3,col=i%7-2;return `<i class="${row===0&&col===0?'origin':coords.has(row+','+col)?'hit':''}"></i>`;}).join('')}</div>`;}
function trainingText(s) {return `${{'PHASE_0':'未精英化','PHASE_1':'精英一','PHASE_2':'精英二'}[s.status.evolvePhase]} Lv.${s.status.charLevel} · 技能 ${s.status.skillLevel} 级 · ${s.module?'模组 '+s.module.level+' 级':'未装配默认模组'} · 信赖 0%`;}
function renderDetail() {
 const base=byChess.get(detail.chess);if(!base)return;
 const o=detail.variant==='backup'&&base.backup?base.backup:base,s=opState(o,detail.elite),sk=s.skills[Math.min(detail.skill,s.skills.length-1)];
 const attrs=[['生命','maxHp'],['攻击','atk'],['防御','def'],['法抗','magicResistance'],['部署费用','cost'],['阻挡数','blockCnt'],['攻击间隔','baseAttackTime'],['再部署','respawnTime']];
 showModal(modalHeader('OPERATOR RECORD / '+base.chessId.toUpperCase())+`<div class="detail-hero"><img src="${o.portrait}" alt="${esc(o.name)}立绘"><div class="detail-info"><span class="bond-tag core">${roman[base.tier]} 阶 · ${detail.elite?'精锐':'初始'}${base.hidden?' / 特殊获取':''}</span><h2>${esc(o.name)}</h2><div class="english">${esc(o.english.toUpperCase())}</div><p>${esc(o.profession)} / ${esc(o.branch)} / ${o.position==='MELEE'?'近战位':'远程位'}</p><div class="card-bonds">${bondTags(o,detail.elite)}</div></div></div><div class="detail-controls"><div class="state-switch"><button data-detail-state="normal" class="${!detail.elite?'active':''}">初始状态</button><button data-detail-state="elite" class="${detail.elite?'active':''}">精锐状态</button></div><button class="dock-open" data-add="${base.chessId}">${selected(base)?'✓ 已在阵容 · 移除':'＋ 加入本局阵容'}</button></div><div class="record-actions"><button data-fav="${base.chessId}" aria-pressed="${favorites.has(base.chessId)}">${favorites.has(base.chessId)?"★ 已收藏":"☆ 收藏"}</button><button data-compare="${base.chessId}" aria-pressed="${comparison.includes(base.chessId)}">⇄ ${comparison.includes(base.chessId)?"已加入对比":"加入对比"}</button></div><p class="training-note">${trainingText(s)}</p>${base.backup?`<div class="notice">未调用时使用原型补位：<button class="source-link" data-variant="${detail.variant==='backup'?'main':'backup'}">查看${esc(detail.variant==='backup'?base.name:base.backup.name)} ↗</button><br>驻守特质与盟约沿用本槽位；战斗技能、职业及属性随实际干员变化。</div>`:''}<section class="detail-section"><h3>驻守特质 <span>${esc(s.traitType)}</span></h3><div class="trait-box">${esc(s.trait)}</div><details class="raw-details"><summary>驻守效果原始参数</summary><pre>${esc(JSON.stringify(s.garrison,null,2))}</pre></details></section><section class="detail-section"><h3>战斗技能 <span>RANK ${s.status.skillLevel}</span></h3><div class="skill-tabs">${s.skills.map(k=>`<button data-detail-skill="${k.index}" class="${k.index===sk.index?'active':''}">S${k.index+1} ${esc(k.name)}${k.index===o.defaultSkill?(base.type==='DIY'?' · 参考':' · 默认'):''}</button>`).join('')}</div>${skillMarkup(sk)}</section><section class="detail-section"><h3>攻击与技能范围 <span>RANGE</span></h3><div class="range-layout"><div><p>常态攻击范围</p>${rangeMarkup(s.range)}</div><div><p>技能范围 ${sk.range?'':'（沿用常态）'}</p>${rangeMarkup(sk.range||s.range)}</div></div><p class="small-note">白色方格为自身；示意朝向向右。超出图窗的全场范围以技能描述为准。</p></section><section class="detail-section"><h3>基础属性 <span>BASE ATTRIBUTES</span></h3><div class="attribute-grid">${attrs.map(([name,key])=>`<div>${name}<b>${['maxHp','atk','def'].includes(key)?Math.round(s.attributes[key]):s.attributes[key]}${['respawnTime','baseAttackTime'].includes(key)?'s':''}</b></div>`).join('')}</div><p class="small-note">按本状态等级插值的裸属性，未计潜能、模组属性、天赋增益、持有加成与盟约／装备。实际战斗面板会变化。</p></section><section class="detail-section"><h3>分支特性与天赋 <span>TALENTS</span></h3><p class="talent-item">${esc(o.description)}</p>${s.talents.map(t=>`<div class="talent-item"><b>${esc(t.name)}</b>${esc(t.description)}</div>`).join('')||'<p class="small-note">当前状态无已解锁天赋。</p>'}</section>${s.module?`<section class="detail-section"><h3>模组 ${esc(s.module.name)} <span>STAGE ${s.module.level}</span></h3>${s.module.effects.map(t=>`<p class="talent-item">${esc(t)}</p>`).join('')}<p class="training-note">模组附加属性：${s.module.attributes.map(x=>`${({atk:'攻击',def:'防御',max_hp:'生命',magic_resistance:'法抗',attack_speed:'攻速'})[x.key]||esc(x.key)} +${x.value}`).join(' / ')}</p></section>`:''}<section class="detail-section"><h3>数据溯源 <span>V3_1</span></h3><p class="small-note">客户端配置快照：${data.meta.clientData}<br>槽位 ID：${esc(base.chessId)}<br>技能 ID：${esc(sk.id)}</p><a class="source-link" href="${data.meta.sourceBase}skill_table.json" target="_blank" rel="noopener">核对原始技能表 ↗</a> · <a class="source-link" href="https://prts.wiki/w/${encodeURIComponent(o.name)}" target="_blank" rel="noopener">PRTS 干员档案 ↗</a></section>`);
}
function showSources() {
 showModal(modalHeader('DATA PROVENANCE / V3_1')+`<div class="sources-copy"><span class="section-index">SOURCE & VERSION</span><h2>数据有出处，决策有依据。</h2><div class="notice">当前版本：${esc(data.meta.season)}<br>开放：${data.meta.start}<br>最近核对：${data.meta.checked} · 国服客户端数据 ${data.meta.clientData}</div><p>期次由鹰角官方公告核对。数值从客户端活动配置与技能表提取，固定到同一个 Git 提交，不跨期拼接。</p><ul class="source-list">${data.meta.sources.map(s=>`<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.title)} ↗</a></li>`).join('')}</ul><h3>收录范围与数值口径</h3><p>143 个固定干员槽位（含 2 个特殊获取槽位），67 组原型补位关系，26 个盟约，${data.strategies.length} 条角色策略，${data.equipment.length} 个可见装备条目。原型可能重复使用，所以不将补位关系数当作新增干员数。</p><p>每个固定槽位包含初始／精锐特质、4／7 级全部技能、初始技力、所需技力、回复方式、持续时间、充能次数、自动施放方案、等级属性、天赋及默认模组。技能数据为基础参数，技能／天赋／模组和局内效果可改变实战表现。</p><p>本期另有 75 名自选候选（含原型），可按Ⅴ／Ⅵ阶查询并加入草案，每阶最多 2 名。同一干员不允许跨阶重复上场。自选干员没有专属驻守特质；核心盟约由客户端 mainPower/subPower 与 powerIdList 匹配，实际选择仍受局内禁用、持有及配置限制。自选技能默认先展示最高序号，各技能均可查；模组按游戏内选择，未擅自预设。未实现站位、装备转职或实际伤害模拟。缪尔赛思等专用自动施放逻辑若没有公开条件，明确保留原始标记。</p><h3>版本与更新</h3><p>这是可追溯的静态快照，后续游戏更新不会自动混入。新一期发布后，需要运行数据提取与校验，再发布对应数据包。</p><code>${data.meta.commit}</code><p><a class="source-link" href="data.json" download="garrison-v3-1.json">下载完整收录数据 JSON ↓</a></p><h3>图片来源</h3><p>26 个盟约图标与 61 名策略发起人头像来自 PRTS 的游戏资源提取，70 件装备按客户端技能图标 ID 精确匹配。图片均打包为本站本地资源。</p><p><a class="source-link" href="https://prts.wiki/w/卫戍协议·规程/PRTS盟约记录" target="_blank" rel="noopener">PRTS 图片来源 ↗</a> · <a class="source-link" href="assets/catalog.json" target="_blank" rel="noopener">查看逐图来源 ↗</a></p><h3>隐私与使用</h3><p>不需要账号。收藏、当前阵容和命名预设只存储在本机浏览器。预设不设人为数量上限，实际总量受浏览器存储空间限制。当前阵容可导出用于迁移备份。干员与游戏美术版权归鹰角网络所有；本工具为非官方玩家辅助工具。</p><details class="raw-details"><summary>源文件 SHA-256</summary><pre>${esc(JSON.stringify(data.meta.hashes,null,2))}</pre></details></div>`);
}
function showComparison() {
 if(comparison.length!==2)return;
 showModal(modalHeader('SIDE-BY-SIDE / OPERATOR COMPARISON')+`<div class="detail-controls"><h2 style="font-size:19px;margin:0">干员对照</h2><div class="state-switch" style="margin-left:auto;width:180px"><button data-compare-state="normal" class="${!state.elite?'active':''}">初始状态</button><button data-compare-state="elite" class="${state.elite?'active':''}">精锐状态</button></div></div><div class="comparison-grid">${comparison.map(id=>{const o=byChess.get(id),s=opState(o),sk=s.skills[o.defaultSkill];return `<div><img src="${o.portrait}" alt="${esc(o.name)}"><h2>${esc(o.name)} <small class="muted">${roman[o.tier]}</small></h2><p class="training-note">${trainingText(s)}</p><div class="card-bonds">${bondTags(o)}</div><section class="detail-section"><h3>驻守特质</h3><div class="trait-box">${esc(s.trait)}</div></section><section class="detail-section"><h3>默认技能 · S${o.defaultSkill+1}</h3>${skillMarkup(sk)}</section></div>`;}).join('')}</div>`,true);
}
function openBondDetail(id) {const b=byBond.get(id);if(!b)return;showModal(modalHeader('ALLIANCE / '+id.toUpperCase())+`<div class="sources-copy"><h2 class="bond-detail-title">${bondImage(id)}${esc(b.name)}</h2><div class="notice">起始人数：${b.activeCount} · ${b.core?'核心盟约':'独立盟约'}<br>人数规则：${esc(b.activeConditionTemplate)} / ${esc(b.activeParamList.join(', '))}</div><p style="white-space:pre-line">${esc(b.desc)}</p>${bondFormulaMarkup(b)}<button class="dock-open" data-members="${id}">查找相关干员 ↗</button><details class="raw-details"><summary>原始效果参数</summary><pre>${esc(JSON.stringify(b.buffs,null,2))}</pre></details></div>`);}
function setCapacity(n) {if(n===8&&squad.length>8){toast('请先将阵容减少到 8 人，再关闭人事部文档。');render();return;}capacity=n;persist();render();}
let hoverTarget=null, hoverQueuedTarget=null, hoverTimer, hoverCloseTimer;
function hideHover() {
 clearTimeout(hoverTimer);clearTimeout(hoverCloseTimer);hoverTarget=null;hoverQueuedTarget=null;
 const panel=$('#hover-card');if(panel)panel.hidden=true;
}
function placeHover() {
 if(!hoverTarget?.isConnected){hideHover();return;}
 const panel=$('#hover-card'),rect=hoverTarget.getBoundingClientRect();
 const width=panel.offsetWidth,height=panel.offsetHeight;
 let x=rect.right+12;
 if(x+width>innerWidth-12)x=rect.left-width-12;
 x=Math.max(12,Math.min(innerWidth-width-12,x));
 const y=Math.max(12,Math.min(innerHeight-height-12,rect.top));
 panel.style.left=x+'px';panel.style.top=y+'px';
}
function showHover(target) {
 if(!target?.isConnected)return;
 const panel=$('#hover-card');hoverTarget=target;
 if(target.dataset.bondTip){
  const id=target.dataset.bondTip,b=byBond.get(id);if(!b)return;
  panel.innerHTML=`<div class="hover-heading bond-hover-heading">${bondImage(id)}<div><h3>${esc(b.name)}</h3><small>${b.core?'核心盟约':'独立盟约'} · ${b.activeConditionTemplate==='count_threshold_downward'?'恰好 '+b.activeCount+' 人':b.activeCount+' 人起'}${b.activeConditionTemplate==='count_threshold_upward_golden'?' · 只计精锐':''}</small></div></div><p class="hover-effect">${esc(b.desc)}</p>${b.params?.descParamInfos?.length?`<label class="hover-stack-control">层数试算<input id="hover-stacks" type="number" min="0" max="10000" step="10" value="${state.stacks}"></label>${bondFormulaMarkup(b)}`:''}<p class="hover-help">按本期协议配置显示 · ${target.dataset.bondDetail?'点击查看盟约详情':'点击盟约图标可筛选关联干员'}</p>`;
 }else{
  const o=byChess.get(target.dataset.opTip);if(!o||!$('#overlay').hidden)return;
  const elite=target.dataset.opElite===undefined?state.elite:target.dataset.opElite==='true';
  const s=opState(o,elite),sk=s.skills[o.defaultSkill];
  panel.innerHTML=`<div class="hover-heading"><img class="hover-avatar" src="${o.avatar}" alt="${esc(o.name)}"><div><h3>${esc(o.name)} <span>${roman[o.tier]} 阶</span></h3><small>${esc(o.profession)} / ${esc(o.branch)} · ${elite?'精锐':'初始'}</small><div class="hover-bond-names">${s.bonds.map(id=>esc(byBond.get(id)?.name)).join(' · ')}</div></div></div><div class="hover-identities">${identityChips(o,elite)}</div><div class="hover-label">驻守特质 / ${esc(s.traitType)}</div><p class="hover-trait">${esc(s.trait)}</p><div class="hover-skill"><span>S${o.defaultSkill+1} · ${esc(sk.name)}</span><span>初始 <b>${sk.sp.initSp}</b> / 所需 <b>${sk.sp.spCost}</b></span></div><p class="hover-help">${target.closest('#squad-dock,.squad-row')?'单击头像查看完整档案'+(target.closest('#squad-dock')?' · 右上角 × 移出阵容':''):'头像单击选人 · 右键／Shift+Enter 查看完整档案'}</p>`;
 }
 panel.hidden=false;placeHover();
}
function queueHover(target,delay=130) {
 clearTimeout(hoverCloseTimer);
 if((hoverTarget===target&&!$('#hover-card').hidden)||hoverQueuedTarget===target)return;
 clearTimeout(hoverTimer);hoverQueuedTarget=target;
 hoverTimer=setTimeout(()=>{hoverQueuedTarget=null;showHover(target);},delay);
}
function hoverPointer(event) {
 if(event.pointerType==='touch')return;
 if(event.target.closest('#hover-card')){if(hoverTarget?.dataset.opTip){hideHover();return;}clearTimeout(hoverCloseTimer);return;}
 const target=event.target.closest('[data-bond-tip],[data-op-tip]');
 if(target){if(hoverTarget?.dataset.opTip&&hoverTarget!==target)hideHover();queueHover(target);return;}
 if(hoverTarget?.dataset.opTip||hoverQueuedTarget?.dataset.opTip){hideHover();return;}
 clearTimeout(hoverTimer);hoverQueuedTarget=null;
 clearTimeout(hoverCloseTimer);hoverCloseTimer=setTimeout(hideHover,180);
}
document.addEventListener('pointermove',hoverPointer);
document.addEventListener('pointerover',hoverPointer);
document.addEventListener('pointerleave',hideHover);
document.addEventListener('pointerout',event=>{
 const avatar=event.target.closest('[data-op-tip]');
 if(avatar&&!avatar.contains(event.relatedTarget)&&(hoverTarget===avatar||hoverQueuedTarget===avatar))hideHover();
});
document.addEventListener('focusin',event=>{
 if(event.target.closest('#hover-card')){if(hoverTarget?.dataset.opTip){hideHover();return;}clearTimeout(hoverCloseTimer);return;}
 const target=event.target.closest('[data-bond-tip],[data-op-tip]');
 if(target&&event.target.matches(':focus-visible'))queueHover(target,0);
 else hideHover();
});
document.addEventListener('focusout',event=>{
 clearTimeout(hoverCloseTimer);
 const avatar=event.target.closest('[data-op-tip]');if(avatar&&!avatar.contains(event.relatedTarget)){hideHover();return;}
 if(event.relatedTarget?.closest('#hover-card,[data-bond-tip],[data-op-tip]'))return;
 hoverCloseTimer=setTimeout(()=>{if(!hoverTarget?.matches(':hover')&&!$('#hover-card').matches(':hover'))hideHover();},180);
});
document.addEventListener('contextmenu',event=>{
 const target=event.target.closest('[data-context-open]');if(!target)return;
 event.preventDefault();openDetail(target.dataset.contextOpen);
});
document.addEventListener('change',event=>{
 if(event.target.id!=='hover-stacks')return;
 state.stacks=Math.min(10000,Math.max(0,Number(event.target.value)||0));
 if(hoverTarget)showHover(hoverTarget);
});
window.addEventListener('resize',hideHover);
window.addEventListener('scroll',()=>{if(!$('#hover-card').hidden)hideHover();},{passive:true});
function exportSquad() {const payload={schema:'garrison-nexus/1',season:'V3_1',capacity,squad};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='卫戍阵容-规程序列Ⅰ.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('阵容已导出');}
function validateRoster(p) {
 if(p?.schema!=='garrison-nexus/1'||p.season!=='V3_1'||![8,9].includes(p.capacity)||!Array.isArray(p.squad)||p.squad.length>p.capacity)throw Error('阵容格式或赛季不匹配');
 const ids=new Set(),characters=new Set(),customCounts={};
 const members=p.squad.map(m=>{
  if(!m||!byChess.has(m.chessId)||typeof m.elite!=='boolean'||ids.has(m.chessId))throw Error('含未知或重复干员');
  const o=byChess.get(m.chessId);if(characters.has(o.id))throw Error('同一干员跨阶重复');
  ids.add(m.chessId);characters.add(o.id);
  if(o.type==='DIY'){customCounts[o.tier]=(customCounts[o.tier]||0)+1;if(customCounts[o.tier]>2)throw Error('自选干员每阶最多 2 名');}
  return {chessId:m.chessId,elite:m.elite};
 });
 return {schema:'garrison-nexus/1',season:'V3_1',capacity:p.capacity,squad:members};
}
function readPresets() {
 const raw=readStore(PRESET_KEY,[]),ids=new Set();if(!Array.isArray(raw))return [];
 return raw.flatMap(p=>{
  try{if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim())return [];const roster=validateRoster(p);ids.add(p.id);return [{...roster,id:p.id,name:p.name,createdAt:typeof p.createdAt==='string'?p.createdAt:'',updatedAt:typeof p.updatedAt==='string'?p.updatedAt:''}];}catch{return [];}
 });
}
function changePresets(change) {
 const next=change(readPresets());
 try{localStorage.setItem(PRESET_KEY,JSON.stringify(next));presets=next;return true;}
 catch{toast('本地存储空间不足或不可用，预设未保存。');return false;}
}
function currentRoster() {return {schema:'garrison-nexus/1',season:'V3_1',capacity,squad:squad.map(m=>({...m}))};}
function presetLibraryMarkup() {
 const query=presetQuery.trim().toLowerCase();
 const found=presets.filter(p=>(p.name+' '+p.squad.map(m=>byChess.get(m.chessId).name).join(' ')).toLowerCase().includes(query));
 return `<section class="preset-library" aria-label="本地阵容预设"><div class="preset-heading"><h3>阵容预设 <span>${presets.length} 套</span></h3><small>保存在此浏览器 · 不设套数上限</small></div><form id="preset-save-form" class="preset-save-form" novalidate><label class="sr-only" for="preset-name">新预设名称</label><input id="preset-name" name="preset-name" maxlength="80" required aria-describedby="preset-feedback" placeholder="为当前阵容命名，例如：乌萨斯开局" autocomplete="off"><button type="submit" ${squad.length?'':'disabled'}>＋ 保存为新预设</button></form><p id="preset-feedback" class="preset-feedback" role="status" hidden></p><p class="preset-caption">保存干员、初始／精锐状态与 ${capacity} 人上限。加载会替换当前草案。</p>${presets.length?`<label class="preset-search-wrap"><span>⌕</span><input id="preset-search" type="search" aria-label="搜索阵容预设" placeholder="搜索预设名称或干员…" value="${esc(presetQuery)}" autocomplete="off"></label><div class="preset-list">${found.slice(0,presetLimit).map(p=>`<article class="preset-card" data-preset="${esc(p.id)}"><div class="preset-card-heading"><h4 title="${esc(p.name)}">${esc(p.name)}</h4><small>${p.squad.length} / ${p.capacity} 人</small></div><div class="preset-avatars">${p.squad.map(m=>{const o=byChess.get(m.chessId);return `<img src="${o.avatar}" alt="${esc(o.name)}${m.elite?'（精锐）':''}" title="${esc(o.name)} · ${m.elite?'精锐':'初始'}" loading="lazy">`;}).join('')}</div><div class="preset-card-actions"><button data-preset-load="${esc(p.id)}">加载阵容 ↗</button><button data-preset-update="${esc(p.id)}" ${squad.length?'':'disabled'}>覆盖</button><button data-preset-rename="${esc(p.id)}">改名</button><button data-preset-delete="${esc(p.id)}" aria-label="删除预设${esc(p.name)}">删除</button></div></article>`).join('')||'<p class="preset-empty">没有匹配的预设。</p>'}</div>${found.length>presetLimit?`<button class="preset-more" data-action="preset-more">显示更多预设 · ${Math.min(presetLimit,found.length)} / ${found.length}</button>`:''}`:'<p class="preset-empty">选好阵容后输入名称保存，下次可从这里一键加载。</p>'}</section>`;
}
function renderPresetLibrary() {
 const el=$('.preset-library');if(el)el.outerHTML=presetLibraryMarkup();
}
let presetIdSequence=0;
function newPresetId() {
 if(typeof globalThis.crypto?.randomUUID==='function')return globalThis.crypto.randomUUID();
 return 'preset-'+Date.now().toString(36)+'-'+(++presetIdSequence).toString(36)+'-'+Math.random().toString(36).slice(2);
}
function presetFeedback(message,error=false) {
 const el=$('#preset-feedback');if(!el)return;
 el.textContent=message;el.classList.toggle('error',error);el.hidden=false;
}
function savePreset(name) {
 name=name.trim();
 if(!name){presetFeedback('请先填写预设名称。',true);$('#preset-name').setAttribute('aria-invalid','true');$('#preset-name').focus();return;}
 $('#preset-name').removeAttribute('aria-invalid');
 if(!squad.length){presetFeedback('请先选择至少一名干员。',true);return;}
 const now=new Date().toISOString(),entry={...currentRoster(),id:newPresetId(),name,createdAt:now,updatedAt:now};
 if(changePresets(list=>[entry,...list])){presetQuery='';presetLimit=12;renderPresetLibrary();const message='已保存预设「'+name+'」';presetFeedback(message);toast(message);}
 else presetFeedback('本地存储空间不足或不可用，预设未保存。请允许此站点存储数据后重试。',true);
}
function loadPreset(id) {
 const p=presets.find(p=>p.id===id);if(!p)return;
 try{const roster=validateRoster(p);squad=roster.squad;capacity=roster.capacity;state.query='';$('#search').value='';persist();render();toast('已加载预设「'+p.name+'」');}catch(e){toast('无法加载预设：'+e.message);}
}
function updatePreset(id) {
 if(!squad.length){toast('当前阵容为空');return;}
 const p=presets.find(p=>p.id===id);if(!p)return;
 const before={...p,squad:p.squad.map(m=>({...m}))};
 if(changePresets(list=>list.map(p=>p.id===id?{...p,...currentRoster(),updatedAt:new Date().toISOString()}:p))){renderPresetLibrary();presetUndo('已更新预设「'+p.name+'」',()=>changePresets(list=>list.map(p=>p.id===id?before:p)));}
}
function presetUndo(message,restore) {
 toast(message+' · 点击撤销');$('#toast').classList.add('undo');$('#toast').onclick=()=>{if(restore()){renderPresetLibrary();toast('已撤销预设操作');}};
}
function deletePreset(id) {
 const index=presets.findIndex(p=>p.id===id),before=presets[index];if(!before)return;
 if(changePresets(list=>list.filter(p=>p.id!==id))){renderPresetLibrary();presetUndo('已删除预设「'+before.name+'」',()=>changePresets(list=>{if(list.some(p=>p.id===id))return list;const next=[...list];next.splice(Math.min(index,next.length),0,before);return next;}));}
}
function renamePreset(id) {
 const p=presets.find(p=>p.id===id);if(!p)return;
 showModal(modalHeader('ROSTER PRESET / RENAME')+`<h2 style="font-size:21px">重命名预设</h2><form id="preset-rename-form" class="preset-save-form" data-id="${esc(id)}"><label class="sr-only" for="preset-rename-name">预设名称</label><input id="preset-rename-name" maxlength="80" required value="${esc(p.name)}"><button type="submit">保存名称</button></form>`);
 $('#preset-rename-name').focus();$('#preset-rename-name').select();
}
document.addEventListener('submit',event=>{
 const form=event.target;
 if(form.id==='preset-save-form'){event.preventDefault();savePreset($('#preset-name',form).value);}
 if(form.id==='preset-rename-form'){
  event.preventDefault();const name=$('#preset-rename-name',form).value.trim();if(!name)return;
  if(changePresets(list=>list.map(p=>p.id===form.dataset.id?{...p,name,updatedAt:new Date().toISOString()}:p))){presetQuery='';closeModal();renderPresetLibrary();toast('预设名称已保存');}
 }
});
document.addEventListener('input',event=>{
 if(event.target.id!=='preset-search')return;
 const pos=event.target.selectionStart;presetQuery=event.target.value;presetLimit=12;renderPresetLibrary();const input=$('#preset-search');input?.focus();try{input?.setSelectionRange(pos,pos);}catch{}
});
window.addEventListener('storage',event=>{if(event.key===PRESET_KEY){presets=readPresets();if(state.view==='squad')renderPresetLibrary();}});
async function importSquad(file) {
 if(!file)return;
 try{if(file.size>100000)throw Error('文件过大');const p=validateRoster(JSON.parse(await file.text()));squad=p.squad;capacity=p.capacity;persist();render();toast('阵容已导入，共 '+squad.length+' 名干员');}catch(e){toast('导入失败：'+e.message);}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button,a');if(!b)return;
 const d=b.dataset;
 if(d.ban){changeBan(d.ban);return;}
 if(d.identity){const id=d.identity;if(state.roles.has(id)){state.roles.delete(id);if(id==='stack')state.stackKind='';}else{if(id==='none'){state.roles.clear();state.stackKind='';}else state.roles.delete('none');state.roles.add(id);}state.limit=PAGE_SIZE;render();return;}
 if(d.presetLoad){loadPreset(d.presetLoad);return;}
 if(d.presetUpdate){updatePreset(d.presetUpdate);return;}
 if(d.presetRename){renamePreset(d.presetRename);return;}
 if(d.presetDelete){deletePreset(d.presetDelete);return;}
 if(d.pool){state.pool=d.pool;resetFilters();render();return;}
 if(d.customTier){state.customTier=Number(d.customTier);state.limit=PAGE_SIZE;render();return;}
 if(d.nav){if(!$('#overlay').hidden)closeModal();switchView(d.nav);if(d.nav==='squad')$('#page-title').scrollIntoView({block:'start',behavior:'smooth'});return;}
 if(d.open){openDetail(d.open,d.openElite!==undefined?d.openElite==='true':state.elite);return;}
 if(d.fav){favorites.has(d.fav)?favorites.delete(d.fav):favorites.add(d.fav);persist();render();if(detail.chess&&!$('#overlay').hidden)renderDetail();return;}
 if(d.add){addToSquad(d.add);return;}
 if(d.compare){compareToggle(d.compare);return;}
 if(d.bond && matchMedia('(hover: none)').matches){openBondDetail(d.bond);return;}
 if(d.bond||d.members){const id=d.bond||d.members;if(!$('#overlay').hidden)closeModal();resetFilters();state.bonds.add(id);switchView('operators');$('#page-title').scrollIntoView({block:'start',behavior:'smooth'});return;}
 if(d.filterBond){state.bonds.has(d.filterBond)?state.bonds.delete(d.filterBond):state.bonds.add(d.filterBond);state.limit=PAGE_SIZE;render();return;}
 if(d.tier){const n=Number(d.tier);state.tiers.has(n)?state.tiers.delete(n):state.tiers.add(n);state.limit=PAGE_SIZE;render();return;}
 if(d.state){state.elite=d.state==='elite';render();return;}
 if(d.detailState){detail.elite=d.detailState==='elite';renderDetail();return;}
 if(d.detailSkill!==undefined){detail.skill=Number(d.detailSkill);renderDetail();return;}
 if(d.variant){detail.variant=d.variant;detail.skill=(d.variant==='backup'?byChess.get(detail.chess).backup:byChess.get(detail.chess)).defaultSkill;renderDetail();return;}
 if(d.compareState){state.elite=d.compareState==='elite';render();showComparison();return;}
 if(d.memberState){const m=squad.find(x=>x.chessId===d.memberState);if(m)m.elite=d.value==='elite';persist();render();return;}
 if(d.bondDetail){openBondDetail(d.bondDetail);return;}
 if(d.equipmentTab){state.equipmentTab=d.equipmentTab;render();return;}
 const actions={'ban-toggle':()=>{state.banOpen=!state.banOpen;renderBanControls();$('[data-action=ban-toggle]').focus({preventScroll:true});},'ban-clear':()=>{state.banned.clear();state.limit=PAGE_SIZE;persist();render();},'clear-stack-kind':()=>{state.stackKind='';state.limit=PAGE_SIZE;render();},'preset-more':()=>{presetLimit+=12;renderPresetLibrary();},sources:showSources,close:closeModal,reset:()=>{resetFilters();render();},favorites:()=>{state.favorites=!state.favorites;state.limit=PAGE_SIZE;render();},filters:()=>$('#filters').classList.toggle('mobile-open'),focus:()=>{state.focus=!state.focus;document.body.classList.toggle('focus-mode',state.focus);$('#focus-button').innerHTML=state.focus?'⛶ <span>退出专注</span>':'⛶ <span>局内专注</span>';persist();},grid:()=>setCompact(false),list:()=>setCompact(true),'compare-open':showComparison,'compare-clear':()=>{comparison=[];render();},'clear-squad':()=>{if(!squad.length)return;const before=[...squad];squad=[];persist();render();toast('阵容已清空 · 点击此处可撤销');$('#toast').classList.add('undo');$('#toast').onclick=()=>{squad=before;persist();render();$('#toast').onclick=null;$('#toast').classList.remove('undo');toast('已恢复阵容');};},export:exportSquad,import:()=>$('#squad-import').click()};
 if(actions[d.action])actions[d.action]();
});
function setCompact(v) {state.compact=v;hideHover();document.body.classList.toggle('compact',v);$$('[data-action="grid"],[data-action="list"]').forEach(el=>el.classList.toggle('active',el.dataset.action===(v?'list':'grid')));persist();if(data)render();}
document.addEventListener('change',e=>{const t=e.target;if(t.id==='identity-match'){state.roleMatch=t.value;state.limit=PAGE_SIZE;render();}if(t.id==='stack-kind'){state.stackKind=t.value;if(t.value){state.roles.delete('none');state.roles.add('stack');}state.limit=PAGE_SIZE;render();}if(t.id==='bond-stacks'){state.stacks=Math.min(10000,Math.max(0,Number(t.value)||0));render();}if(t.id==='sort')render();if(t.id==='match-mode'){state.match=t.value;render();}if(t.id==='profession-filter'){state.profession=t.value;state.limit=PAGE_SIZE;render();}if(t.id==='trait-filter'){state.trait=t.value;state.limit=PAGE_SIZE;render();}if(t.id==='capacity'||t.id==='capacity-page')setCapacity(t.checked?9:8);if(t.id==='squad-import')importSquad(t.files[0]);});
$('#search').addEventListener('input',e=>{clearTimeout(searchTimer);state.query=e.target.value;state.limit=PAGE_SIZE;searchTimer=setTimeout(render,90);});
$('#overlay').addEventListener('click',e=>{if(e.target===$('#overlay'))closeModal();});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){hideHover();if(!$('#overlay').hidden){closeModal();return;}}
 if(e.key==='Enter'&&e.shiftKey&&e.target.dataset.contextOpen){e.preventDefault();openDetail(e.target.dataset.contextOpen);return;}
 if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&$('#overlay').hidden){e.preventDefault();$('#search').focus();}
 if(e.key==='Tab'&&!$('#overlay').hidden){const els=$$('button:not(:disabled),a[href],input,select,summary,[tabindex="0"]',$('#detail-panel')).filter(el=>!el.hidden);if(!els.length)return;const first=els[0],last=els.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('#detail-panel'))){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
window.addEventListener('hashchange',()=>switchView(location.hash.slice(1)));
try {
 const responses=await Promise.all([fetch('data.json'),fetch('assets/catalog.json')]);for(const response of responses)if(!response.ok)throw Error('HTTP '+response.status);[data,artwork]=await Promise.all(responses.map(response=>response.json()));
 ops=data.operators;bonds=data.bonds;byChess=new Map([...ops,...data.customOperators].map(o=>[o.chessId,o]));byBond=new Map(bonds.map(b=>[b.bondId,b]));[...ops,...data.customOperators].forEach(o=>o.searchText=searchable(o));
 state.banned=new Set([...state.banned].filter(id=>byBond.has(id)));
 presets=readPresets();
 squad=(Array.isArray(saved.squad)?saved.squad:[]).filter((m,i,all)=>m&&byChess.has(m.chessId)&&typeof m.elite==='boolean'&&all.findIndex(x=>x?.chessId===m.chessId)===i).slice(0,capacity).map(m=>({chessId:m.chessId,elite:m.elite}));
 document.body.classList.toggle('focus-mode',state.focus);$('#focus-button').innerHTML=state.focus?'⛶ <span>退出专注</span>':'⛶ <span>局内专注</span>';setCompact(state.compact);switchView(location.hash.slice(1)||'operators');
} catch(error) {$('#content').innerHTML=`<div class="empty-state"><strong>档案加载失败</strong>请检查网络后刷新重试。<br>${esc(error.message)}</div>`;$('#result-count').textContent='数据未载入';}
