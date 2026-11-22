import sys, zlib, struct
from collections import Counter
def load(p):
    d = open(p,'rb').read()
    if d[:3]==b'CWS': d = d[:8]+zlib.decompress(d[8:])
    nb = d[8]>>3; rl = (5+4*nb+7)//8
    bits = int.from_bytes(d[8:8+rl],'big'); tot=rl*8
    vals=[(bits>>(tot-5-nb*(i+1)))&((1<<nb)-1) for i in range(4)]
    pos = 8+rl
    fps = d[pos+1]; fc = struct.unpack_from('<H',d,pos+2)[0]; pos+=4
    return d,pos,vals,fps,fc
def tags(d,pos,end=None):
    end = end or len(d)
    while pos<end:
        h = struct.unpack_from('<H',d,pos)[0]; pos+=2
        code=h>>6; ln=h&63
        if ln==63: ln=struct.unpack_from('<I',d,pos)[0]; pos+=4
        yield code,pos,ln
        pos+=ln
        if code==0: break
if __name__=='__main__':
    d,pos,vals,fps,fc = load(sys.argv[1])
    print('stage twips',vals,'px',[v/20 for v in vals],'fps',fps,'frames',fc,'size',len(d))
    c=Counter(); sz=Counter()
    for code,p,ln in tags(d,pos): c[code]+=1; sz[code]+=ln
    for k,v in sorted(c.items()): print(k,v,sz[k])
