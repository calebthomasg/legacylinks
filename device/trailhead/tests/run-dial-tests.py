"""Set LVGL_PATH to LVGL 8.3.10 (folder containing lvgl.h and src). Requires gcc/g++."""
from pathlib import Path
import os, subprocess, tempfile, concurrent.futures
root=Path(__file__).resolve().parents[1]
lib=Path(os.environ['LVGL_PATH']).resolve()
firmware=root/'firmware/TrailheadFirstBoot'
flags=['-I'+str(root/'tests/mock'),'-DLV_CONF_PATH='+str(root/'lv_conf.h'),'-I'+str(lib),'-I'+str(firmware)]
with tempfile.TemporaryDirectory() as temp:
 p=Path(temp)
 sources=[f for f in (lib/'src').rglob('*.c') if not any(x in f.relative_to(lib/'src').parts for x in ['examples','demos'])]
 def compile_one(f):
  obj=p/('_'.join(f.relative_to(lib).parts)+'.o')
  subprocess.run(['gcc','-O1',*flags,'-c',str(f),'-o',str(obj)],check=True)
  return str(obj)
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:objects=list(pool.map(compile_one,sources))
 for f in firmware.glob('nav_*.c'):
  obj=p/(f.stem+'.o')
  subprocess.run(['gcc',*flags,'-c',str(f),'-o',str(obj)],check=True)
  objects.append(str(obj))
 artwork=(firmware/'OpeningArtwork.cpp').read_text().replace('#include <Arduino.h>','#define PROGMEM')
 (p/'artwork.cpp').write_text(artwork)
 subprocess.run(['g++','-std=c++17',*flags,str(root/'tests/test-ui.cpp'),str(firmware/'DialAssets.cpp'),str(firmware/'PetopiaTestAssets.cpp'),str(p/'artwork.cpp'),*objects,'-lm','-o',str(p/'ui')],check=True)
 card=p/'card'
 subprocess.run(['python3',str(root/'tools/pack_petopia.py'),str(card/'trailhead/petopia')],check=True)
 subprocess.run([str(p/'ui')],cwd=root,env={**os.environ,'PETOPIA_TEST_CARD':str(card)},check=True)
