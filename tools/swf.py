import sys, zlib, struct, io, json, os, base64
from collections import defaultdict, Counter
from swftags import load, tags

class BR:
    def __init__(s, d, pos): s.d=d; s.pos=pos; s.bit=0
    def align(s):
        if s.bit: s.bit=0; s.pos+=1
    def ub(s, n):
        v=0
        while n>0:
            avail=8-s.bit; take=min(avail,n)
            byte=s.d[s.pos]
            v=(v<<take)|((byte>>(avail-take))&((1<<take)-1))
            s.bit+=take; n-=take
            if s.bit==8: s.bit=0; s.pos+=1
        return v
    def sb(s, n):
        if n==0: return 0
        v=s.ub(n)
        return v-(1<<n) if v>>(n-1) else v
    def u8(s): s.align(); v=s.d[s.pos]; s.pos+=1; return v
    def u16(s): s.align(); v=struct.unpack_from('<H',s.d,s.pos)[0]; s.pos+=2; return v
    def u32(s): s.align(); v=struct.unpack_from('<I',s.d,s.pos)[0]; s.pos+=4; return v
    def s16(s): s.align(); v=struct.unpack_from('<h',s.d,s.pos)[0]; s.pos+=2; return v
    def string(s):
        s.align(); e=s.d.index(b'\0',s.pos); v=s.d[s.pos:e].decode('utf-8','replace'); s.pos=e+1; return v
    def rect(s):
        s.align(); n=s.ub(5); r=[s.sb(n) for _ in range(4)]; s.align(); return r  # xmin,xmax,ymin,ymax
    def matrix(s):
        s.align(); a=d=1.0; b=c=0.0
        if s.ub(1): n=s.ub(5); a=s.sb(n)/65536; d=s.sb(n)/65536
        if s.ub(1): n=s.ub(5); b=s.sb(n)/65536; c=s.sb(n)/65536
        n=s.ub(5); tx=s.sb(n); ty=s.sb(n); s.align()
        return [a,b,c,d,tx/20,ty/20]
    def cxforma(s):
        s.align(); ha=s.ub(1); hm=s.ub(1); n=s.ub(4)
        m=[1,1,1,1]; a=[0,0,0,0]
        if hm: m=[s.sb(n)/256 for _ in range(4)]
        if ha: a=[s.sb(n) for _ in range(4)]
        s.align(); return m+a
    def rgb(s): return (s.u8(),s.u8(),s.u8(),255)
    def rgba(s): return (s.u8(),s.u8(),s.u8(),s.u8())

def parse_fillstyle(br, ver):
    t=br.u8()
    if t==0: return {'t':'solid','c':br.rgba() if ver>=3 else br.rgb()}
    if t in (0x10,0x12,0x13):
        m=br.matrix(); br.align(); spread=br.ub(2); interp=br.ub(2); n=br.ub(4)
        stops=[(br.u8(), br.rgba() if ver>=3 else br.rgb()) for _ in range(n)]
        f=0
        if t==0x13: f=br.s16()/256
        return {'t':'grad','kind':t,'m':m,'stops':stops,'spread':spread,'focal':f}
    if t in (0x40,0x41,0x42,0x43):
        bid=br.u16(); m=br.matrix(); return {'t':'bmp','id':bid,'m':m,'kind':t}
    raise Exception('fill type %x'%t)
def parse_fills(br, ver):
    n=br.u8()
    if n==0xff and ver>=2: n=br.u16()
    return [parse_fillstyle(br,ver) for _ in range(n)]
def parse_lines(br, ver):
    n=br.u8()
    if n==0xff: n=br.u16()
    out=[]
    for _ in range(n):
        w=br.u16()
        if ver<4: out.append({'w':w/20,'c':br.rgba() if ver>=3 else br.rgb()})
        else:
            sc=br.ub(2); j=br.ub(2); hf=br.ub(1); br.ub(3); br.ub(5); br.ub(1); ec=br.ub(2)
            ml=None
            if j==2: ml=br.u16()/256
            if hf:
                f=parse_fillstyle(br,ver); c=f.get('c') or (f['stops'][0][1] if f.get('stops') else (0,0,0,255))
            else: c=br.rgba()
            out.append({'w':w/20,'c':c,'cap':sc,'join':j,'miter':ml})
    return out

def parse_shape(d, pos, ln, ver):
    br=BR(d,pos); sid=br.u16(); bounds=br.rect()
    if ver==4: br.rect(); br.u8()
    groups=[]  # each: fills, lines, edges list (fill0,fill1,line,segs)
    fills=parse_fills(br,ver); lines=parse_lines(br,ver)
    br.align(); nf=br.ub(4); nl=br.ub(4)
    cur={'fills':fills,'lines':lines,'edges':[]}; groups.append(cur)
    x=y=0; f0=f1=li=0
    while True:
        if br.ub(1)==0:
            fl=br.ub(5)
            if fl==0: break
            if fl&1: n=br.ub(5); x=br.sb(n); y=br.sb(n)
            if fl&2: f0=br.ub(nf)
            if fl&4: f1=br.ub(nf)
            if fl&8: li=br.ub(nl)
            if fl&16:
                br.align(); fills=parse_fills(br,ver); lines=parse_lines(br,ver)
                br.align(); nf=br.ub(4); nl=br.ub(4)
                cur={'fills':fills,'lines':lines,'edges':[]}; groups.append(cur)
        else:
            if br.ub(1):
                n=br.ub(4)+2
                if br.ub(1): dx=br.sb(n); dy=br.sb(n)
                elif br.ub(1): dx=0; dy=br.sb(n)
                else: dx=br.sb(n); dy=0
                nx=x+dx; ny=y+dy
                cur['edges'].append((f0,f1,li,(x,y),None,(nx,ny)))
            else:
                n=br.ub(4)+2
                cx=x+br.sb(n); cy=y+br.sb(n); nx=cx+br.sb(n); ny=cy+br.sb(n)
                cur['edges'].append((f0,f1,li,(x,y),(cx,cy),(nx,ny)))
            x,y=nx,ny
    return sid, bounds, groups

def col(c): return '#%02x%02x%02x'%c[:3], c[3]/255
def f(v):
    s='%.2f'%(v/20); s=s.rstrip('0').rstrip('.') if '.' in s else s
    return s or '0'

def shape_svg(sid, groups, defs, bitmaps):
    out=[]
    for gi,g in enumerate(groups):
        byfill=defaultdict(list); byline=defaultdict(list)
        for (f0,f1,li,p0,c,p1) in g['edges']:
            if f1: byfill[f1].append((p0,c,p1))
            if f0: byfill[f0].append((p1,c,p0))
            if li: byline[li].append((p0,c,p1))
        for fi in sorted(byfill):
            edges=byfill[fi]
            start=defaultdict(list)
            for i,e in enumerate(edges): start[e[0]].append(i)
            used=[False]*len(edges); parts=[]
            for i in range(len(edges)):
                if used[i]: continue
                e=edges[i]; used[i]=True
                parts.append('M%s %s'%(f(e[0][0]),f(e[0][1])))
                while True:
                    if e[1]: parts.append('Q%s %s %s %s'%(f(e[1][0]),f(e[1][1]),f(e[2][0]),f(e[2][1])))
                    else: parts.append('L%s %s'%(f(e[2][0]),f(e[2][1])))
                    nxt=None
                    lst=start.get(e[2])
                    if lst:
                        while lst and used[lst[-1]]: lst.pop()
                        if lst: nxt=lst.pop()
                    if nxt is None: break
                    used[nxt]=True; e=edges[nxt]
                parts.append('Z')
            if fi-1>=len(g['fills']): continue
            fs=g['fills'][fi-1]; attr=''
            if fs['t']=='solid':
                c,a=col(fs['c']); attr='fill="%s"'%c + ('' if a>=1 else ' fill-opacity="%.3f"'%a)
            elif fs['t']=='grad':
                gid='g%d_%d_%d'%(sid,gi,fi); m=fs['m']
                stops=''.join('<stop offset="%.4f" stop-color="%s"%s/>'%(r/255,col(c)[0],'' if c[3]==255 else ' stop-opacity="%.3f"'%(c[3]/255)) for r,c in fs['stops'])
                sp=['pad','reflect','repeat','pad'][fs['spread']]
                tr='gradientTransform="matrix(%g %g %g %g %g %g)"'%tuple(m)
                if fs['kind']==0x10:
                    defs.append('<linearGradient id="%s" gradientUnits="userSpaceOnUse" x1="-819.2" x2="819.2" y1="0" y2="0" spreadMethod="%s" %s>%s</linearGradient>'%(gid,sp,tr,stops))
                else:
                    defs.append('<radialGradient id="%s" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="819.2" fx="%g" fy="0" spreadMethod="%s" %s>%s</radialGradient>'%(gid,fs['focal']*819.2,sp,tr,stops))
                attr='fill="url(#%s)"'%gid
            else:
                bm=bitmaps.get(fs['id'])
                if not bm: continue
                gid='p%d_%d_%d'%(sid,gi,fi); m=fs['m']
                defs.append('<pattern id="%s" patternUnits="userSpaceOnUse" width="%d" height="%d" patternTransform="matrix(%g %g %g %g %g %g)"><use href="#bm%d"/></pattern>'%(gid,bm[0],bm[1],m[0]/20,m[1]/20,m[2]/20,m[3]/20,m[4],m[5],fs['id']))
                attr='fill="url(#%s)"'%gid
            out.append('<path %s fill-rule="evenodd" d="%s"/>'%(attr,''.join(parts)))
        for li in sorted(byline):
            if li-1>=len(g['lines']): continue
            ls=g['lines'][li-1]; parts=[]; last=None
            for p0,c,p1 in byline[li]:
                if p0!=last: parts.append('M%s %s'%(f(p0[0]),f(p0[1])))
                if c: parts.append('Q%s %s %s %s'%(f(c[0]),f(c[1]),f(p1[0]),f(p1[1])))
                else: parts.append('L%s %s'%(f(p1[0]),f(p1[1])))
                last=p1
            c,a=col(ls['c']); w=max(ls['w'],0.5)
            cap=['round','butt','square'][ls.get('cap',0)] if ls.get('cap',0)<3 else 'round'
            join=['round','bevel','miter'][ls.get('join',0)] if ls.get('join',0)<3 else 'round'
            out.append('<path fill="none" stroke="%s"%s stroke-width="%g" stroke-linecap="%s" stroke-linejoin="%s" d="%s"/>'%(c,'' if a>=1 else ' stroke-opacity="%.3f"'%a,w,cap,join,''.join(parts)))
    return ''.join(out)

def skip_filters(br):
    n=br.u8(); fl=[]
    for _ in range(n):
        t=br.u8(); p=br.pos
        if t==0:
            c=br.rgba(); bx=br.u32()/65536; by=br.u32()/65536; ang=br.u32()/65536; dist=br.u32()/65536; st=br.u16()/256; flg=br.u8()
            fl.append({'t':'shadow','c':c,'bx':bx,'by':by,'ang':ang,'dist':dist,'st':st,'flags':flg})
        elif t==1: bx=br.u32()/65536; by=br.u32()/65536; br.u8(); fl.append({'t':'blur','bx':bx,'by':by})
        elif t==2:
            c=br.rgba(); bx=br.u32()/65536; by=br.u32()/65536; st=br.u16()/256; flg=br.u8()
            fl.append({'t':'glow','c':c,'bx':bx,'by':by,'st':st,'flags':flg})
        elif t==3: br.pos+=27; fl.append({'t':'bevel'})
        elif t in (4,7): k=br.u8(); br.pos+=k*5+19; fl.append({'t':'gradglow'})
        elif t==5: mx=br.u8(); my=br.u8(); br.pos+=8+mx*my*4+5; fl.append({'t':'conv'})
        elif t==6:
            m=struct.unpack_from('<20f',br.d,br.pos); br.pos+=80; fl.append({'t':'cm','m':list(m)})
        else: raise Exception('filter %d'%t)
    return fl

def parse_place(d,pos,ln,code):
    br=BR(d,pos); fl=br.u8(); fl2=br.u8() if code==70 else 0
    depth=br.u16(); o={'depth':depth,'move':bool(fl&1)}
    if code==70 and (fl2&0x08 or (fl2&0x10 and fl&2)): o['cls']=br.string()
    if fl&2: o['id']=br.u16()
    if fl&4: o['m']=br.matrix()
    if fl&8: o['cx']=br.cxforma()
    if fl&16: o['ratio']=br.u16()
    if fl&32: o['name']=br.string()
    if fl&64: o['clip']=br.u16()
    if fl2&1: o['filters']=skip_filters(br)
    if fl2&2: o['blend']=br.u8()
    if fl2&4: br.u8()
    if fl2&0x20: o['visible']=br.u8()
    return o

def timeline(d,pos,end):
    frames=[]; dl={}; labels={}
    for code,p,ln in tags(d,pos,end):
        if code in (26,70):
            o=parse_place(d,p,ln,code); dp=o['depth']
            if o['move'] and dp in dl:
                n=dict(dl[dp])
                if 'id' in o and o['id']!=n.get('id'):
                    n['id']=o['id']
                for k in ('m','cx','ratio','name','clip','filters','blend','visible'):
                    if k in o: n[k]=o[k]
                dl[dp]=n
            else:
                o.pop('move'); dl[dp]=o
        elif code==28:
            dl.pop(struct.unpack_from('<H',d,p)[0],None)
        elif code==5:
            dl.pop(struct.unpack_from('<H',d,p+2)[0],None)
        elif code==43:
            labels[d[p:d.index(b'\0',p)].decode()]=len(frames)+1
        elif code==1:
            frames.append({k:dict(v) for k,v in dl.items()})
    return frames, labels

def parse_swf(path):
    d,pos,vals,fps,fc=load(path)
    R={'shapes':{},'bitmaps':{},'sprites':{},'sounds':{},'symbols':{},'bounds':{}}
    for code,p,ln in tags(d,pos):
        if code in (2,22,32,83):
            ver={2:1,22:2,32:3,83:4}[code]
            sid,b,groups=parse_shape(d,p,ln,ver); R['shapes'][sid]=groups; R['bounds'][sid]=[b[0]/20,b[2]/20,b[1]/20,b[3]/20]
        elif code in (35,21,6,20,36,90):
            R['bitmaps'][struct.unpack_from('<H',d,p)[0]]=(code,p,ln)
        elif code==39:
            sid,nf=struct.unpack_from('<HH',d,p)
            fr,lab=timeline(d,p+4,p+ln); R['sprites'][sid]={'frames':fr,'labels':lab}
        elif code==14:
            sid=struct.unpack_from('<H',d,p)[0]; R['sounds'][sid]=(p,ln)
        elif code==76:
            n=struct.unpack_from('<H',d,p)[0]; q=p+2
            for _ in range(n):
                cid=struct.unpack_from('<H',d,q)[0]; e=d.index(b'\0',q+2); R['symbols'][cid]=d[q+2:e].decode(); q=e+1
    R['main'],R['labels']=timeline(d,pos,len(d))
    R['d']=d
    return R
