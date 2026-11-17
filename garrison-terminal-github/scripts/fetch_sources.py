"""Download the exact client snapshot used by build_data.py; never follows master."""
import concurrent.futures,urllib.request
from pathlib import Path
COMMIT='7e560050b03c34661db1d322d008733072352b2a'
FILES={'activity_table':'activity_table','char_table':'character_table','skill_table':'skill_table','char_patch_table':'char_patch_table','uniequip_table':'uniequip_table','battle_equip_table':'battle_equip_table','range_table':'range_table'}
root=Path(__file__).resolve().parents[1]/'data/raw';root.mkdir(parents=True,exist_ok=True)
def download(entry):
 local,remote=entry;dest=root/(local+'.json')
 if dest.exists():return local+' (cached)'
 url=f'https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/{COMMIT}/zh_CN/gamedata/excel/{remote}.json'
 payload=urllib.request.urlopen(url,timeout=90).read();tmp=dest.with_suffix('.tmp');tmp.write_bytes(payload);tmp.replace(dest);return local
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for result in pool.map(download,FILES.items()):print(result)
