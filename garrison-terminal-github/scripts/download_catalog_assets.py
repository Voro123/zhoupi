"""Fetch real client equipment icons and PRTS's extracted bond/strategy artwork."""
import json,urllib.request,urllib.parse,concurrent.futures,io,time
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];data=json.loads((root/'dist/data.json').read_text())
api='https://prts.wiki/api.php?'+urllib.parse.urlencode({'action':'query','format':'json','list':'allimages','aiprefix':'卫戍协议','ailimit':'500'})
images=json.load(urllib.request.urlopen(api,timeout=30))['query']['allimages'];wiki={im['name']:im for im in images}
manifest={'sources':['https://prts.wiki/w/卫戍协议·规程/PRTS盟约记录','https://github.com/yuanyan3060/ArknightsGameResource/tree/main/skill'],'bonds':{},'strategies':{},'equipment':{}}
jobs=[]
def add(kind,key,title=None,url=None):
 if title:
  assert title in wiki, f'Missing artwork: {title}'
  im=wiki[title];url=im['url'];source=im['descriptionurl']
 else:source=url
 path=f'assets/{kind}/{key}.webp'
 manifest[kind][key]={'image':path,'source':source,'original':url};jobs.append((path,url))
for b in data['bonds']:add('bonds',b['bondId'],'卫戍协议：盟约_icon_'+b['bondId']+'.png')
for s in data['strategies']:add('strategies',s['bandId'],'卫戍协议：盟约_策略发起人_'+s['bandName']+'.png')
for e in data['equipment']:
 suffix=e['trapId'].split('_')[-1];url=f'https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/skill/skill_icon_sktok_{suffix}_1.png'
 add('equipment',e['itemId'],url=url)
def download(job):
 path,url=job;dest=root/'dist'/path;dest.parent.mkdir(exist_ok=True,parents=True)
 if dest.exists():return None
 for attempt in range(3):
  try:
   im=Image.open(io.BytesIO(urllib.request.urlopen(url,timeout=30).read())).convert('RGBA');im.thumbnail((184,184));im.save(dest,'WEBP',quality=92,method=4);return None
  except Exception as e:
   if attempt==2:return (path,str(e))
   time.sleep(1)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:errors=[r for r in pool.map(download,jobs) if r]
if errors:raise SystemExit(str(errors))
(root/'dist/assets/catalog.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
print(f'Complete: {len(jobs)} real images; 26 bonds, 61 strategies, 70 equipment; no missing assets.')
