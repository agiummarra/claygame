"""Estrae grafica e suoni dai file SWF originali e genera assets/ per la versione web.
Uso: python3 tools/extract.py   (richiede Pillow, numpy, cwebp e chrome-headless-shell)"""
import os, sys, json, struct, subprocess
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
sys.path.insert(0,HERE)
from render import Ctx, build_scene, render_items
from swftags import load
SRC=os.path.join(ROOT,'Riferimenti','Sorgenti')
TMP=os.environ.get('CLAY_TMP',os.path.join(ROOT,'.extract_tmp')); os.makedirs(TMP,exist_ok=True)
IMG=os.path.join(ROOT,'assets','img'); AUD=os.path.join(ROOT,'assets','audio')

def sounds(ctx):
    d=ctx.d
    for sid,(p,ln) in ctx.R['sounds'].items():
        name=ctx.R['symbols'].get(sid,'sound%d'%sid); fmt=d[p+2]>>4
        out=os.path.join(AUD,name+'.mp3')
        if os.path.exists(out): continue
        if fmt==2: open(out,'wb').write(d[p+9:p+ln])
        else: print('formato audio non gestito',name,fmt)

scenes={}
game=Ctx(os.path.join(SRC,'Gioca.swf'),os.path.join(TMP,'gioca.pkl'))
sounds(game)
for key,frame in (('s1',1),('s2',24),('s3',49),('s4',72)):
    scenes[key]=render_items(game,build_scene(game,frame),IMG,TMP,key); print(key,len(scenes[key]))
menu=Ctx(os.path.join(SRC,'ClayGame.swf'),os.path.join(TMP,'menu.pkl'))
sounds(menu)
scenes['menu']=render_items(menu,build_scene(menu,1,all_named=True),IMG,TMP,'menu'); print('menu',len(scenes['menu']))
json.dump(scenes,open(os.path.join(ROOT,'assets','scenes.json'),'w'),separators=(',',':'))
# versione caricabile con <script> (funziona anche aprendo index.html da file://)
open(os.path.join(ROOT,'assets','scenes.js'),'w').write('window.SCENES='+json.dumps(scenes,separators=(',',':'))+';\n')
used={e['src'] for v in scenes.values() for e in v}
files=['assets/img/'+f for f in sorted(used)]+['assets/audio/'+f for f in sorted(os.listdir(AUD)) if f.endswith('.mp3')]
json.dump(files,open(os.path.join(ROOT,'assets','files.json'),'w'))
