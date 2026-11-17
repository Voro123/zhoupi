import json,urllib.request,concurrent.futures,time,io
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1];data=json.loads((root/'dist/data.json').read_text());ops=data['operators']+data.get('customOperators',[])
ids={x['id'] for o in ops for x in [o,o.get('backup')] if x}
def get(cid,kind):
 dest=root/'dist/assets'/kind/(cid+'.webp');dest.parent.mkdir(parents=True,exist_ok=True)
 if dest.exists():return
 path=('portrait/'+cid+'_1.png') if kind=='portraits' else ('avatar/'+cid+'.png')
 if cid=='char_1037_amiya3':path=('portrait/' if kind=='portraits' else 'avatar/')+cid+'_2.png'
 url='https://raw.githubusercontent.com/yuanyan3060/ArknightsGameResource/main/'+path
 for attempt in range(3):
  try:
   im=Image.open(io.BytesIO(urllib.request.urlopen(url,timeout=35).read())).convert('RGBA')
   if kind=='portraits':im.thumbnail((420,580))
   else:im.thumbnail((128,128))
   im.save(dest,'WEBP',quality=87,method=4);return
  except Exception as e:
   if attempt==2:return (cid,kind,str(e))
   time.sleep(1)
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
 failed=[r for r in pool.map(lambda job:get(*job),[(cid,k) for cid in ids for k in ['portraits','avatars']]) if r]
print('Assets:',len(ids),'characters;',len(failed),'failures',failed)
