// Auxiliary identities use the current season's garrison effects, never a combat ranking.
export const ROLE_DEFINITIONS = [
  {id:'stack',label:'高效叠层',symbol:'↟'},
  {id:'economy',label:'经济干员',symbol:'¤'}
];
export const STACK_KINDS = [
  {id:'fixed',label:'回合叠层'},
  {id:'battle',label:'战斗叠层'},
  {id:'scaling',label:'数量叠层'},
  {id:'temporary',label:'临时叠层'}
];
const ECONOMIC_EFFECTS = new Map([
  ['SERVER_GAIN_FREE_REFRESH_COUNT','免费刷新'],
  ['SERVER_GAIN_FREE_REFRESH_UPGRADE_COUNT','免费刷新'],
  ['SERVER_GAIN_SPECIAL_REFRESH_BOND_CHAR','定向刷新'],
  ['SERVER_ONCE_GOLD','资金收益'],
  ['SERVER_SELF_SELL_PRICE_DELTA','售出增值'],
  ['SERVER_SELF_SELL_PRICE_FIXED','售出回收'],
  ['SERVER_CHESS_PRICE','低价购买'],
  ['SERVER_GAIN_EQUIP','装备收益'],
  ['SERVER_GAIN_RANDOM_EQUIP','装备收益'],
  ['SERVER_POOL_EQUIP','装备收益'],
  ['SERVER_UPGRADE_SELF_EQUIP','装备升级'],
  ['SERVER_POOL_CHAR','干员收益'],
  ['SERVER_MOST_BOND','干员收益'],
  ['SERVER_SELL_CHESS_GAIN_SPECIAL_GOODS','免费招募']
]);
const THRESHOLD=4;
const board=effect=>Object.fromEntries((effect.blackboard||[]).map(v=>[v.key,v.valueStr===null?v.value:v.valueStr]));
export function stackAssessment(operator,elite=false) {
  const state=operator[elite?'elite':'normal'];
  const no=reason=>({qualified:false,reason});
  if(!state||operator.type==='DIY')return no('自选干员没有专属驻守特质。');
  const text=state.trait||'',effects=state.garrison||[];
  const ownBondCount=Math.max(1,new Set(state.bonds||[]).size);
  const bondCount=bb=>{const scope=bb.bond_id??bb.bond;return bb.bond_type==='bond_self'||scope==='SELF'?ownBondCount:scope?new Set(String(scope).split(',').filter(Boolean)).size:1;};
  const types=new Set(effects.map(e=>e.effectType));
  if(state.traitType==='单次叠加'||text.startsWith('<获得时>'))return no('仅在获得时一次性产层，不按每回合持续产层标记。');
  if(types.has('SERVER_TRIGGER_ANOTHER')||types.has('SERVER_TRIGGER_FRONT_COUNT')||types.has('SERVER_FRONT_SAME_EFFECT_PREP_FIN'))return no('需要复制或触发搭档特质，无法仅凭自身确定每回合产层量。');
  if(types.has('SERVER_CONVERT_TEMP_BOND')||types.has('SERVER_CONVERT_TEMP_BOND_BY_BOND_CHAR'))return no('这是临时层转固定层，并非直接新增层数，暂不按直接产层 ≥4 高亮。');
  if(text.includes('叠层上限')||text.includes('额外+')||text.includes('盟约获得强化'))return no('这是叠层增幅或上限辅助，不能单凭增幅值当成每场直接产层量。');
  if(state.traitType!=='持续叠加')return no('没有可用于判断单回合产层的持续叠层特质。');
  const candidates=[],below=[];
  const add=(kind,amount,reason,conditional=false)=>{if(amount>=THRESHOLD)candidates.push({qualified:true,kind,amount,reason,conditional});else below.push(amount);};
  const condition=(multiplier,cap,unit,detail='')=>{
    if(!(multiplier>0))return;
    if(cap>0&&cap<THRESHOLD){below.push(cap);return;}
    const required=Math.ceil(THRESHOLD/multiplier);
    add('scaling',cap>=THRESHOLD?cap:required*multiplier,`每${unit} +${multiplier} 层；达到 ${required} ${unit}时可达 +${required*multiplier} 层${cap>0?`，每回合上限 ${cap} 层`:''}。${detail}这是满足数量条件后的能力，不保证实战打满。`,true);
  };
  // Aggregate all explicitly affected bonds. Repeated phases of the same bond also combine.
  // For position effects, count the operator's known bonds; do not invent an unknown ally's factions.
  const fixed=new Map(),seen=new Set();
  for(const effect of effects) {
    const bb=board(effect),type=effect.effectType;
    if(type==='SERVER_ADD_BOND'&&effect.eventType!=='SERVER_GAIN') {
      for(const bond of String(bb.bond||'SELF').split(',')){
        const key=effect.eventType+'|'+bond+'|'+bb.count;if(seen.has(key))continue;seen.add(key);
        fixed.set(bond,(fixed.get(bond)||0)+(Number(bb.count)||0));
      }
    } else if(type==='SERVER_ADD_BOND_POSITION'||type==='SERVER_ADD_BOND_ACTIVATED_MOST_LAYER') {
      const amount=(Number(bb.count)||0)*(type==='SERVER_ADD_BOND_POSITION'?ownBondCount:1);
      if(type==='SERVER_ADD_BOND_POSITION'&&amount<THRESHOLD&&(Number(bb.count)||0)*(ownBondCount+1)>=THRESHOLD)add('scaling',(Number(bb.count)||0)*(ownBondCount+1),'邻位干员带来额外已激活盟约时，合计产层可达到 4 层；需要满足站位与盟约条件。',true);else add('fixed',amount,`满足盟约和站位条件时，每回合按已知受益盟约合计 +${amount} 层。`);
    } else if(type==='SERVER_GAIN_BOND_LAYER_BY_REFRESH_CNT') {
      const amount=(Number(bb.layer)||0)*bondCount(bb);
      add('scaling',amount,`本回合首次主动刷新时，对应盟约合计 +${amount} 层。`,true);
    } else if(type==='SERVER_ADD_BOND_METHOD') {
      const units={round_gain_char:'名本回合获得的干员',same_row:'名同一行干员',same_bond_diff_lv:'名不同等阶的对应盟约干员',hand_count:'名整备区干员'};
      if(units[bb.add_method])condition(Number(bb.multi)*bondCount(bb),(Number(bb.max)||0)*bondCount(bb),units[bb.add_method]);
    } else if(type==='SERVER_ADD_ACTIVATED_BOND_BY_ALIVE_CHAR') {
      condition(Number(bb.count)*bondCount(bb),0,'名战后存活的我方干员');
    } else if(type==='SERVER_ADD_BOND_BOARD_EQUIP_CHAR') {
      condition(Number(bb.count)*bondCount(bb),0,'名携带装备的干员');
    } else if(type==='SERVER_ADD_BOND_IN_HAND') {
      condition(Number(bb.count),0,'名共享同一已激活盟约的整备区干员','只对共享该盟约的干员计数。');
    } else if(type==='SERVER_ADD_BOND_BOARD_SELL_PRICE') {
      condition(Number(bb.multi)*bondCount(bb),(Number(bb.max)||0)*bondCount(bb),'点场上干员售出价格合计');
    } else if(type==='SERVER_ADD_BOND_POSITION_COUNT_SELL_PRICE') {
      condition(Number(bb.multi)*ownBondCount,0,'点受益干员自身售出价格','已知受益盟约的层数相加，其他目标按各自条件生效。');
    } else if(type==='SERVER_ADD_REFRESH_CNT_MULTIPLIER_BOND_LAYER') {
      condition(Number(bb.multiplier)*bondCount(bb),(Number(bb.max_layer)||0)*bondCount(bb),'次本回合刷新');
    } else if(type==='SERVER_ADD_BOND_ROUND_COIN_COST') {
      const per=Number(bb.layer)*bondCount(bb),coins=Number(bb.count),cap=(Number(bb.max)||0)*bondCount(bb);
      if(per>0&&coins>0)add('scaling',cap,`每消耗 ${coins} 资金 +${per} 层；本回合至少消耗 ${Math.ceil(THRESHOLD/per)*coins} 资金时可达 +${Math.ceil(THRESHOLD/per)*per} 层，上限 ${cap} 层。消耗资金不是经济收益。`,true);
    } else if(type==='ADD_BOND'&&bb.garrison_type==='garrison_add_bond'&&Number(bb.bond_add_count)>0) {
      const per=Number(bb.bond_add_count)*bondCount(bb),cap=(Number(bb.max_add_count_per_battle)||0)*bondCount(bb);
      if(cap>0)add('battle',cap,`每次满足战斗触发条件 +${per} 层；至少触发 ${Math.ceil(THRESHOLD/per)} 次可达 +${Math.ceil(THRESHOLD/per)*per} 层，单场上限 ${cap} 层。上限不等于实际获得，具体条件见驻守特质。`,true);
      else if(bb.garrison_event_key==='gar_event_battlestart')add(bb.bond_add_as_tmp?'temporary':'battle',per,`每场战斗开始时 +${per}${bb.bond_add_as_tmp?' 层临时层数；临时层不等于永久积累':' 层'}。`);
    }
  }
  if(fixed.size){const amount=[...fixed.values()].reduce((sum,n)=>sum+n,0);add('fixed',amount,`每回合休整或结算阶段，对应盟约层数合计 +${amount} 层。`);}
  // Some direct stack effects are granted to allies by reference. The rendered client description
  // supplies their exact trigger amount and cap (e.g. Warfarin and elite Lappland the Decadenza).
  if(!candidates.length&&!below.length) {
    const cap=Number(text.match(/(?:每场战斗|每回合|每名干员每回合)至多叠加(\d+)层/)?.[1]);
    const per=Number(text.match(/层数\+(\d+)/)?.[1]);
    if(cap>0&&per>0)add('battle',cap,`赋予对应干员每次触发 +${per} 层的能力；至少 ${Math.ceil(THRESHOLD/per)} 次可达 +${Math.ceil(THRESHOLD/per)*per} 层，单场上限 ${cap} 层。需要满足受益干员、站位和触发条件。`,true);
  }
  if(candidates.length)return candidates.sort((a,b)=>a.conditional-b.conditional||b.amount-a.amount)[0];
  return no(below.length?`当前状态已知受益盟约合计的单回合定额或明确上限为 ${Math.max(...below)} 层，低于 4 层。`:'没有足够明确的单回合直接产层数值，暂不高亮。');
}
export function classifyOperator(operator, elite=false) {
  const state=operator[elite?'elite':'normal'];
  if(!state||operator.type==='DIY')return [];
  const effects=new Set((state.garrison||[]).map(effect=>effect.effectType));
  const text=state.trait||'',roles=[],assessment=stackAssessment(operator,elite);
  const add=(id,kind,reason,conditional=false)=>roles.push({id,kind,reason,conditional});
  if(assessment.qualified){add('stack',assessment.kind,assessment.reason,assessment.conditional);roles.at(-1).amount=assessment.amount;}
  if(effects.has('SERVER_TRIGGER_ANOTHER')||effects.has('SERVER_TRIGGER_FRONT_COUNT')) {
    add('economy','条件资源联动','配合前方具有“获得时”资源特质的干员，可再次触发其干员、装备或刷新收益；需有对应搭档。',true);
    return roles;
  }
  if(effects.has('SERVER_FRONT_SAME_EFFECT_PREP_FIN')) {
    add('economy','条件资源联动','需前方干员具有“休整期结束时”经济特质（例如海沫的售出增值），复制后才能获得对应收益。',true);
    return roles;
  }
  const economic=[...effects].filter(type=>ECONOMIC_EFFECTS.has(type));
  if(economic.length)add('economy',[...new Set(economic.map(type=>ECONOMIC_EFFECTS.get(type)))].join(' / '),'本期特质直接提供资金、刷新、干员或装备收益，或降低购买成本；收益条件以驻守特质为准。');
  if(effects.has('NONE')&&text.includes('只需两名本干员即可合成精锐'))add('economy','合成节省','只需两名本干员即可合成精锐，可节省合成所需的干员份数；不直接产出资金。');
  return roles;
}
