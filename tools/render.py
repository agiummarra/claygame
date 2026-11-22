import sys, os, io, json, math, pickle, zlib, struct, hashlib, base64, subprocess
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import numpy as np
from swf import shape_svg, parse_swf
from swftags import load

CHROME=os.path.expanduser('~/Library/Caches/ms-playwright/chromium_headless_shell-1200/chrome-headless-shell-mac-x64/chrome-headless-shell')
W,H=1280,1024
ID=[1,0,0,1,0,0]
BLEND={3:'multiply',4:'screen',5:'lighten',6:'darken',8:'plus-lighter',13:'overlay',14:'hard-light'}

class Ctx:
    def __init__(s, swfpath, cache):
        if os.path.exists(cache): s.R=pickle.load(open(cache,'rb'))
        else:
            R=parse_swf(swfpath); R.pop('d'); pickle.dump(R,open(cache,'wb')); s.R=R
        s.d=load(swfpath)[0]; s.memo={}; s.bm={}; s.shape_cache={}
    def bitmap(s,bid):
        if bid in s.bm: return s.bm[bid]
        code,p,ln=s.R['bitmaps'][bid]; d=s.d
        off=struct.unpack_from('<I',d,p+2)[0]; jpg=d[p+6:p+6+off]; adata=d[p+6+off:p+ln]
        if jpg[:4]==b'\xff\xd9\xff\xd8': jpg=jpg[4:]
        jpg=jpg.replace(b'\xff\xd9\xff\xd8',b'')
        im=Image.open(io.BytesIO(jpg)); im.load()
        if im.format=='JPEG' and adata:
            a=np.frombuffer(zlib.decompress(adata),dtype=np.uint8).reshape(im.size[1],im.size[0])
            rgb=np.asarray(im.convert('RGB')).astype(np.float32)
            af=np.maximum(a.astype(np.float32),1)[...,None]
            rgb=np.clip(rgb*255/af,0,255).astype(np.uint8)
            im=Image.fromarray(np.dstack([rgb,a]),'RGBA')
        else: im=im.convert('RGBA')
        b=io.BytesIO(); im.save(b,'PNG')
        s.bm[bid]=(im.size[0],im.size[1],'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode())
        return s.bm[bid]
    def lb(s,cid):
        if cid in s.memo: return s.memo[cid]
        R=s.R
        if cid in R['bounds']: b=R['bounds'][cid]
        else:
            b=None
            fr=R['sprites'].get(cid,{}).get('frames') or [{}]
            for o in fr[0].values():
                if 'clip' in o: continue
                c=tb(s.lb(o['id']),o.get('m',ID))
                if c: b=c if not b else [min(b[0],c[0]),min(b[1],c[1]),max(b[2],c[2]),max(b[3],c[3])]
        s.memo[cid]=b; return b

def tb(b,m):
    if not b: return None
    pts=[(b[0],b[1]),(b[2],b[1]),(b[0],b[3]),(b[2],b[3])]
    xs=[m[0]*x+m[2]*y+m[4] for x,y in pts]; ys=[m[1]*x+m[3]*y+m[5] for x,y in pts]
    return [min(xs),min(ys),max(xs),max(ys)]

class Doc:
    """collects defs for one svg document"""
    def __init__(s,ctx): s.ctx=ctx; s.defs=[]; s.shapes={}; s.bms=set(); s.n=0
    def uid(s,p): s.n+=1; return '%s%d'%(p,s.n)
    def shape(s,sid):
        if sid not in s.shapes:
            c=s.ctx
            if sid not in c.shape_cache:
                d=[]; bm={}
                for g in c.R['shapes'][sid]:
                    for fs in g['fills']:
                        if fs['t']=='bmp' and fs['id'] in c.R['bitmaps']: bm[fs['id']]=c.bitmap(fs['id'])[:2]
                body=shape_svg(sid,c.R['shapes'][sid],d,bm)
                c.shape_cache[sid]=(body,d,list(bm))
            body,d,bms=c.shape_cache[sid]
            s.defs+=d
            for b in bms:
                if b not in s.bms:
                    s.bms.add(b); w,h,uri=c.bitmap(b)
                    s.defs.append('<image id="bm%d" width="%d" height="%d" href="%s"/>'%(b,w,h,uri))
            s.defs.append('<g id="s%d">%s</g>'%(sid,body)); s.shapes[sid]=1
        return '<use href="#s%d"/>'%sid
    def filt(s,o,bb):
        """returns filter id or None for placement o (filters + color transform)"""
        prim=[]; pad=0; cur='SourceGraphic'
        cx=o.get('cx')
        if cx and (cx[:3]!=[1,1,1] or any(cx[4:])):
            prim.append('<feColorMatrix type="matrix" values="%g 0 0 0 %g 0 %g 0 0 %g 0 0 %g 0 %g 0 0 0 %g %g" result="cx"/>'%(cx[0],cx[4]/255,cx[1],cx[5]/255,cx[2],cx[6]/255,cx[3],cx[7]/255)); cur='cx'
        for i,fl in enumerate(o.get('filters',[])):
            if fl['t'] in ('glow','shadow'):
                sx=max(fl['bx']/3.2,0.01); sy=max(fl['by']/3.2,0.01); c=fl['c']; inner=fl['flags']&0x80; ko=fl['flags']&0x40
                dx=dy=0
                if fl['t']=='shadow': dx=math.cos(fl['ang'])*fl['dist']; dy=math.sin(fl['ang'])*fl['dist']
                pad=max(pad,fl['bx']*1.5+abs(dx),fl['by']*1.5+abs(dy))
                r='f%d'%i
                prim.append('<feGaussianBlur in="%s" stdDeviation="%g %g" result="%sb"/>'%(cur,sx,sy,r))
                src=r+'b'
                if dx or dy: prim.append('<feOffset in="%sb" dx="%g" dy="%g" result="%so"/>'%(r,dx,dy,r)); src=r+'o'
                prim.append('<feFlood flood-color="rgb(%d,%d,%d)" flood-opacity="%g" result="%sf"/>'%(c[0],c[1],c[2],c[3]/255,r))
                if inner:
                    prim.append('<feComposite in="%sf" in2="%s" operator="out" result="%sc"/>'%(r,src,r))
                    prim.append('<feComponentTransfer in="%sc" result="%ss"><feFuncA type="linear" slope="%g"/></feComponentTransfer>'%(r,r,fl['st']))
                    prim.append('<feComposite in="%ss" in2="%s" operator="in" result="%si"/>'%(r,cur,r))
                    prim.append('<feMerge result="%sm"><feMergeNode in="%s"/><feMergeNode in="%si"/></feMerge>'%(r,cur,r))
                else:
                    prim.append('<feComposite in="%sf" in2="%s" operator="in" result="%sc"/>'%(r,src,r))
                    prim.append('<feComponentTransfer in="%sc" result="%ss"><feFuncA type="linear" slope="%g"/></feComponentTransfer>'%(r,r,fl['st']))
                    if ko: prim.append('<feComposite in="%ss" in2="%s" operator="out" result="%sm"/>'%(r,cur,r))
                    else: prim.append('<feMerge result="%sm"><feMergeNode in="%ss"/><feMergeNode in="%s"/></feMerge>'%(r,r,cur))
                cur=r+'m'
            elif fl['t']=='blur':
                prim.append('<feGaussianBlur in="%s" stdDeviation="%g %g" result="b%d"/>'%(cur,fl['bx']/3.2,fl['by']/3.2,i)); cur='b%d'%i; pad=max(pad,fl['bx']*1.5,fl['by']*1.5)
        if not prim: return None,0
        fid=s.uid('f'); bb=bb or [0,0,1,1]; p=pad+4
        s.defs.append('<filter id="%s" filterUnits="userSpaceOnUse" x="%g" y="%g" width="%g" height="%g" color-interpolation-filters="sRGB">%s</filter>'%(fid,bb[0]-p,bb[1]-p,bb[2]-bb[0]+2*p,bb[3]-bb[1]+2*p,''.join(prim)))
        return fid,pad
    def node(s,o,top=False,override_m=None):
        m=override_m or o.get('m',ID)
        if o.get('visible',1)==0: return ''
        inner=s.emit(o['id'])
        if not inner: return ''
        g='<g transform="matrix(%g %g %g %g %g %g)">%s</g>'%(m[0],m[1],m[2],m[3],m[4],m[5],inner)
        fid,_=s.filt(o,tb(s.ctx.lb(o['id']),m))
        attrs=''
        if fid: attrs+=' filter="url(#%s)"'%fid
        cx=o.get('cx')
        wrap=''
        if cx and cx[:3]==[1,1,1] and not any(cx[4:]) and cx[3]!=1 and not top: wrap+=' opacity="%g"'%max(0,cx[3])
        if not top and o.get('blend') in BLEND: wrap+=' style="mix-blend-mode:%s"'%BLEND[o['blend']]
        if attrs: g='<g%s>%s</g>'%(attrs,g)
        if wrap: g='<g%s>%s</g>'%(wrap,g)
        return g
    def children(s,objs):
        out=[]; i=0
        while i<len(objs):
            o=objs[i]
            if 'clip' in o:
                j=i+1; grp=[]
                while j<len(objs) and objs[j]['depth']<=o['clip']: grp.append(objs[j]); j+=1
                mid=s.uid('m'); m=o.get('m',ID)
                if 'white' not in s.shapes:
                    s.shapes['white']=1; s.defs.append('<filter id="white" filterUnits="userSpaceOnUse" x="-5000" y="-5000" width="12000" height="12000"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1000 0"/></filter>')
                s.defs.append('<mask id="%s" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="12000" height="12000"><g filter="url(#white)"><g transform="matrix(%g %g %g %g %g %g)">%s</g></g></mask>'%(mid,m[0],m[1],m[2],m[3],m[4],m[5],s.emit(o['id'])))
                out.append('<g mask="url(#%s)">%s</g>'%(mid,s.children(grp)))
                i=j
            else: out.append(s.node(o)); i+=1
        return ''.join(out)
    def emit(s,cid):
        R=s.ctx.R
        if cid in R['shapes']: return s.shape(cid)
        sp=R['sprites'].get(cid)
        if not sp or not sp['frames']: return ''
        fr=sp['frames'][0]
        return s.children([fr[k] for k in sorted(fr)])
    def svg(s,body,box,scale):
        x,y,w,h=box
        return '<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="%g %g %g %g"><defs>%s</defs>%s</svg>'%(round(w*scale),round(h*scale),x,y,w,h,''.join(s.defs),body)

def top_pad(o):
    pad=0
    for fl in o.get('filters',[]):
        if fl['t'] in ('glow','shadow','blur'):
            d=fl.get('dist',0); pad=max(pad,fl['bx']*1.5+d,fl['by']*1.5+d)
    return pad

def build_scene(ctx, frame, keep=None, all_named=False):
    """returns list of items: dict(name, objs, box, meta)"""
    fr=ctx.R['main'][frame-1]; items=[]; cur=None
    for dp in sorted(fr):
        o=fr[dp]; m=o.get('m',ID); b=tb(ctx.lb(o['id']),m)
        if not b or o.get('visible',1)==0: continue
        name=o.get('name')
        if (b[2]<=1 or b[0]>=W-1) and not (all_named and name): continue
        if keep and name and not keep(name): name=None
        if not name:
            if b[3]<=1 or b[1]>=H-1: continue
            if cur is None: cur={'name':None,'objs':[],'bb':None}; items.append(cur)
            p=top_pad(o); b=[b[0]-p,b[1]-p,b[2]+p,b[3]+p]
            cur['objs'].append(o); cur['bb']=b if not cur['bb'] else [min(cur['bb'][0],b[0]),min(cur['bb'][1],b[1]),max(cur['bb'][2],b[2]),max(cur['bb'][3],b[3])]
        else:
            cur=None; p=top_pad(o)+3
            items.append({'name':name,'objs':[o],'bb':[b[0]-p,b[1]-p,b[2]+p,b[3]+p]})
    return items

def render_items(ctx, items, outdir, tmpdir, prefix):
    os.makedirs(outdir,exist_ok=True); os.makedirs(tmpdir,exist_ok=True)
    jobs=[]; meta=[]
    for it in items:
        bb=it['bb']
        if it['name'] is None:
            bb=[max(bb[0],0),max(bb[1],0),min(bb[2],W),min(bb[3],H)]
        x0=math.floor(bb[0]); y0=math.floor(bb[1]); w=math.ceil(bb[2])-x0; h=math.ceil(bb[3])-y0
        if w<=0 or h<=0: continue
        doc=Doc(ctx); top=it['name'] is not None
        body=''.join(doc.node(o,top=top) for o in it['objs'])
        scale=2 if w*h<700*500 else 1.5
        svg=doc.svg(body,(x0,y0,w,h),scale)
        hsh=hashlib.md5(svg.encode()).hexdigest()[:10]
        fn=(it['name'] or 'layer')+'_'+hsh
        e={'src':fn+'.webp','x':x0,'y':y0,'w':w,'h':h}
        if top:
            o=it['objs'][0]; m=o.get('m',ID)
            e['name']=it['name']; e['ox']=round(m[4],2); e['oy']=round(m[5],2); e['sx']=round(m[0],4); e['sy']=round(m[3],4)
            cx=o.get('cx')
            if cx and cx[3]!=1: e['alpha']=cx[3]
            if o.get('blend') in BLEND: e['blend']=BLEND[o['blend']]
        meta.append(e)
        if not os.path.exists(os.path.join(outdir,fn+'.webp')):
            sp=os.path.join(tmpdir,fn+'.svg'); open(sp,'w').write(svg)
            jobs.append((sp,os.path.join(tmpdir,fn+'.png'),os.path.join(outdir,fn+'.webp'),round(w*scale),round(h*scale)))
    def run(j):
        sp,png,webp,pw,ph=j
        import threading
        ud=os.path.join(tmpdir,'ud_%d'%threading.get_ident())
        for attempt in range(3):
          try:
            r=subprocess.run([CHROME,'--headless','--disable-gpu','--hide-scrollbars','--user-data-dir='+ud,'--default-background-color=00000000','--screenshot='+os.path.abspath(png),'--window-size=%d,%d'%(pw,ph),'file://'+os.path.abspath(sp)],capture_output=True,timeout=90)
            if os.path.exists(png): break
          except subprocess.TimeoutExpired as ex:
            r=ex; r.stderr=b'timeout'
        if not os.path.exists(png): return 'FAIL '+sp+' '+r.stderr.decode()[-300:]
        subprocess.run(['cwebp','-quiet','-q','82','-alpha_q','90','-m','5',png,'-o',webp],capture_output=True)
        if os.path.getsize(webp)<400: return 'SMALL '+webp
        os.remove(png)
        return None
    with ThreadPoolExecutor(5) as ex:
        for r in ex.map(run,jobs):
            if r: print(r)
    return meta
