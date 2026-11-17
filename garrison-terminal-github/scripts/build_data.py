"""Reproducible V3_1 extraction. Downloaded client tables are the sole numeric source."""
import json,re,math,hashlib,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'data/raw'
COMMIT='7e560050b03c34661db1d322d008733072352b2a'
BASE='https://github.com/Kengxxiao/ArknightsGameData/blob/'+COMMIT+'/zh_CN/gamedata/excel/'
load=lambda n:json.loads((RAW/(n+'.json')).read_text())
activity=load('activity_table'); season=activity['activity']['AUTOCHESS']['act3autochess']['V3_1']; auto=activity['autoChessData']
chars=load('char_table'); chars.update(load('char_patch_table')['patchChars'])
skills=load('skill_table'); modules=load('uniequip_table'); battlemods=load('battle_equip_table');ranges=load('range_table')
unresolved=[]
def plain(s):
 return re.sub(r'<(?:[@$][^>]*|/)>','',s or '').replace('\\n','\n')
def render(s,bb):
 values={b['key'].lower():b['valueStr'] if b.get('valueStr') is not None else b['value'] for b in bb or []}
 def sub(m):
  expr=m[1];key,_,fmt=expr.partition(':'); neg=key.startswith('-');key=key.lstrip('-').lower()
  if key not in values: unresolved.append((s,key));return m[0]
  v=values[key]
  if isinstance(v,str):return v
  if neg:v=-v
  if '%' in fmt:return f'{v*100:.{len(fmt.split(".")[1].rstrip("%")) if "." in fmt else 0}f}%'
  return f'{v:g}'
 return re.sub(r'\{([^{}]+)\}',sub,plain(s))
def phaseidx(s):return int(s[-1])
def allowed(cond,status):
 return phaseidx(cond.get('phase','PHASE_0'))<phaseidx(status['evolvePhase']) or (cond.get('phase')==status['evolvePhase'] and cond.get('level',1)<=status['charLevel'])
def candidate(rows,status,pot=0):
 valid=[x for x in rows or [] if x.get('requiredPotentialRank',0)<=pot and allowed(x.get('unlockCondition',{}),status)]
 return valid[-1] if valid else None
def stats(char,status):
 ph=char['phases'][min(phaseidx(status['evolvePhase']),len(char['phases'])-1)];frames=ph['attributesKeyFrames'];lo,hi=frames[0],frames[-1];t=(status['charLevel']-lo['level'])/max(hi['level']-lo['level'],1)
 return {k:round(lo['data'][k]+(hi['data'][k]-lo['data'][k])*t,3) for k in ['maxHp','atk','def','magicResistance','cost','blockCnt','baseAttackTime','respawnTime','spRecoveryPerSec']}
def state(char,row,modid,pot=0):
 st=row['status'];lv=st['skillLevel'];tal=[]
 for x in char.get('talents') or []:
  c=candidate(x['candidates'],st,pot)
  if c and not c.get('isHideTalent'):tal.append({'name':c['name'],'description':render(c['description'],c['blackboard'])})
 mod=None
 if st['equipLevel']>0 and modid and modid in modules['equipDict'] and modid in battlemods:
  m=modules['equipDict'][modid];p=battlemods[modid]['phases'][st['equipLevel']-1];parts=[]
  for part in p['parts']:
   for key in ['overrideTraitDataBundle','addOrOverrideTalentDataBundle']:
    c=candidate((part.get(key) or {}).get('candidates'),st,pot)
    if c:
     text=c.get('upgradeDescription') or c.get('additionalDescription') or c.get('overrideDescripton') or c.get('description')
     if text:parts.append(render(text,c.get('blackboard')))
  mod={'id':modid,'name':m['uniEquipName'],'level':st['equipLevel'],'effects':parts,'attributes':p['attributeBlackboard']}
 sk=[]
 for i,entry in enumerate(char.get('skills') or []):
  sid=entry['skillId']; skill=skills[sid]['levels'][lv-1]
  trigger=[]
  for rule in auto['skillTriggerDataList']:
   if rule['charId']:
    match=rule['charId']==char['_id'] and rule['skillIndex'] in (-1,i)
   elif rule['subProfessionId']:match=rule['subProfessionId']==char['subProfessionId'] and rule['skillIndex'] in (-1,i)
   else:match=rule['profession']==char['profession'] and rule['skillIndex'] in (-1,i)
   if match:trigger=rule['skillTriggerTypes']
  rng=auto['skillRangeDict'].get(sid,skill['rangeId'])
  sk.append({'id':sid,'index':i,'name':skill['name'],'level':lv,'description':render(skill['description'],skill['blackboard']),'rawDescription':skill['description'],'blackboard':skill['blackboard'],'type':skill['skillType'],'sp':skill['spData'],'duration':skill['duration'],'durationType':skill['durationType'],'range':ranges.get(rng),'trigger':trigger,'unlock':entry['unlockCond'],'available':allowed(entry['unlockCond'],st)})
 gs=[season['garrisonDataDict'][g] for g in row.get('garrisonIds') or []]
 return {'status':st,'trait':plain(row['desc']),'traitType':gs[0]['eventTypeDesc'] if gs else '特殊','garrison':gs,'bonds':row['bondIds'],'skills':sk,'attributes':stats(char,st),'talents':tal,'module':mod,'range':ranges.get(char['phases'][min(phaseidx(st['evolvePhase']),len(char['phases'])-1)]['rangeId'])}
prof={'PIONEER':'先锋','WARRIOR':'近卫','TANK':'重装','SNIPER':'狙击','CASTER':'术师','MEDIC':'医疗','SUPPORT':'辅助','SPECIAL':'特种'}
ops=[]
def make(charid,tmpl,skillidx,modid,a,b,pot=0):
 cid=tmpl or charid;c=dict(chars[cid]);c['_id']=cid
 return {'id':cid,'name':c['name'],'english':c['appellation'],'profession':prof.get(c['profession'],c['profession']),'branch':modules['subProfDict'].get(c['subProfessionId'],{}).get('subProfessionName',c['subProfessionId']),'position':c['position'],'description':plain(c['description']),'defaultSkill':skillidx,'portrait':'assets/portraits/'+cid+'.webp','avatar':'assets/avatars/'+cid+'.webp','normal':state(c,a,modid,pot),'elite':state(c,b,modid,pot)}
for chessid,row in season['charShopChessDatas'].items():
 if row['chessType']=='DIY':continue
 a=season['charChessDataDict'][chessid];b=season['charChessDataDict'][row['goldenChessId']]
 op=make(row['charId'],row['tmplId'],row['defaultSkillIndex'],row['defaultUniEquipId'],a,b)
 op.update({'chessId':chessid,'tier':row['chessLevel'],'type':row['chessType'],'hidden':row['isHidden'],'order':row['shopLevelSortId'],'backup':None})
 if row['backupCharId'] and (row['backupCharId']!=row['charId'] or row['backupTmplId']!=row['tmplId']):
  op['backup']=make(row['backupCharId'],row['backupTmplId'],row['backupCharSkillIndex'],row['backupCharUniEquipId'],a,b,row.get('backupCharPotRank',0))
 ops.append(op)
# Runtime DIY slots: six-star units outside the fixed pool, including reserve operators.
# Inferred core membership uses exactly the game's mainPower/subPower and powerIdList.
fixed_ids={o['id'] for o in ops}
custom=[]
for cid,c in chars.items():
 if not cid.startswith('char_') or c['rarity']!='TIER_6' or cid in fixed_ids:continue
 power=set(v for p in [c.get('mainPower') or {},*(c.get('subPower') or [])] for v in p.values() if v)
 bondids=[id for id,g in auto['bondInfoDict'].items() if g['isPower'] and id in season['bondInfoDict'] and power.intersection(g['powerIdList'])]
 if not bondids:bondids=['emptyShip']
 for tier in [5,6]:
  ca=dict(season['charChessDataDict'][f'chess_char_{tier}_diy1_a']);cb=dict(season['charChessDataDict'][f'chess_char_{tier}_diy1_b'])
  for row in [ca,cb]:row.update({'desc':'自选干员无专属驻守特质；核心盟约按干员势力归属匹配。','garrisonIds':[],'bondIds':bondids})
  op=make(cid,None,len(c['skills'])-1,None,ca,cb)
  for st in ['normal','elite']:op[st]['traitType']='自选干员'
  op.update({'chessId':f'diy_{tier}_{cid}','tier':tier,'type':'DIY','hidden':False,'order':c['sortIndex'],'backup':None,'bondBasis':'mainPower/subPower matched to client powerIdList; confirm in game'})
  custom.append(op)
assert len(custom)==150, f'Unexpected custom candidate count {len(custom)}'
bonds=[]
for id,b in season['bondInfoDict'].items():
 glob=auto['bondInfoDict'].get(id,{})
 bonds.append({**b,'desc':plain(b['desc']),'core':glob.get('isPower',False),'params':season['effectDescParamDataDict'].get(b['effectId']),'buffs':season['effectBuffInfoDataDict'].get(b['effectId'],[])})
strategies=[]
for id,b in season['bandDataListDict'].items():
 strategies.append({**b,**auto['bandDataDict'].get(id,{}),'bandDesc':plain(b['bandDesc'])})
equip=[]
for id,r in season['trapShopChessDatas'].items():
 if r['hideInShop']:continue
 variants=[]
 for eid in [id,r.get('goldenItemId')]:
  if not eid:continue
  e=season['trapChessDataDict'].get(eid)
  if e:
   eff=season['effectInfoDataDict'].get(e.get('effectId'),{})
   variants.append({**e,'effect':{**eff,'effectDesc':plain(eff.get('effectDesc'))},'buffs':season['effectBuffInfoDataDict'].get(e.get('effectId'),[])})
 equip.append({**r,'variants':variants})
data={'meta':{'season':'卫戍协议·规程·序列Ⅰ','version':'V3_1','activityId':'act3autochess','start':'2026-11-08 16:00 (UTC+8)','checked':'2026-11-17','clientData':'26-11-13-06-37-23','commit':COMMIT,'sourceBase':BASE,'sources':[{'title':'鹰角网络 · 本期官方公告','url':'https://ak.hypergryph.com/news/0787.html'},{'title':'客户端活动配置 · 固定快照','url':BASE+'activity_table.json'},{'title':'技能表 · 原始技力与黑板参数','url':BASE+'skill_table.json'},{'title':'干员表 · 属性与天赋','url':BASE+'character_table.json'},{'title':'PRTS · 卫戍协议帮助','url':'https://prts.wiki/w/卫戍协议/帮助'},{'title':'贴图资源 · ArknightsGameResource','url':'https://github.com/yuanyan3060/ArknightsGameResource'}],'hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in RAW.glob('*.json') if p.name!='season.json'}},'operators':ops,'customOperators':custom,'bonds':bonds,'strategies':strategies,'equipment':equip,'diySlots':season['diyChessDict'],'rules':{'skillTrigger':auto['skillTriggerDataList'],'training':season['shopCharChessInfoData'],'modes':season['modeDataDict'],'const':season['constData']}}
assert len(ops)==143 and len(bonds)==26
assert all(len(o['normal']['skills'])>o['defaultSkill'] for o in ops)
if unresolved:
 print('UNRESOLVED',unresolved[:20]);raise SystemExit(1)
if '--check' in sys.argv:
 old=json.loads((ROOT/'dist/data.json').read_text());assert old==data,'Regenerate data before building'
else:(ROOT/'dist/data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
print(f'Validated {len(ops)} slots, {sum(bool(o["backup"]) for o in ops)} backup relations, {len(bonds)} bonds; all skill parameters resolved.')
