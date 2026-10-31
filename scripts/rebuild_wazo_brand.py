#!/usr/bin/env python3
"""Rebuild only branding resources of the installed Wazo TV APK.
Preserves app package, classes.dex and all runtime data; signs with same keystore.
Requires Pillow through PYTHONPATH. Run from Mac mini only.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import hashlib, io, os, subprocess, sys, zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Volumes/Wazo-Projects/Backups/WazoTV/2026-10-31/WazoTV_installed_before_brand.apk')
OUT = ROOT / 'build'
OUT.mkdir(exist_ok=True)
SDK = Path.home() / 'Library/Android/sdk/build-tools/36.0.0'
JAVA_HOME = '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home'
KEY = Path.home() / '.android/debug.keystore'
assert SOURCE.is_file() and KEY.is_file()
with zipfile.ZipFile(SOURCE) as z:
    original = Image.open(io.BytesIO(z.read('res/drawable/wazo_icon_v2.png'))).convert('RGBA')
    manifest = z.read('AndroidManifest.xml')
assert original.size == (512, 512)

# Convert square artwork into genuine 16:9 television art; never stretch original.
w, h = 1280, 720
background = Image.new('RGBA', (w,h), (8, 11, 32, 255))
pix = background.load()
for y in range(h):
    for x in range(w):
        v = (x / w)*0.72 + (y/h)*0.28
        pix[x,y] = (int(6+16*v), int(13+11*v), int(39+15*v), 255)
banner = background.copy()
glow = Image.new('RGBA', (w,h), (0,0,0,0))
g = ImageDraw.Draw(glow)
g.ellipse((30,20,780,725), fill=(10,181,247,65))
g.ellipse((540,65,1280,700), fill=(240,40,178,38))
glow = glow.filter(ImageFilter.GaussianBlur(85))
banner = Image.alpha_composite(banner,glow)
art = original.resize((585,585), Image.Resampling.LANCZOS)
banner.alpha_composite(art, (68,67))
d = ImageDraw.Draw(banner)
font_candidates = [
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
]
fontfile = next((f for f in font_candidates if Path(f).exists()),None)
font = ImageFont.truetype(fontfile, 113) if fontfile else ImageFont.load_default()
small = ImageFont.truetype(fontfile, 37) if fontfile else ImageFont.load_default()
# Coherent wordmark, aligned to source art rather than distorting square logo.
d.text((683,263), 'WAZO TV', font=font, fill=(242,249,255,255),
       stroke_width=1, stroke_fill=(98,222,255,220))
d.rounded_rectangle((688,419,1140,424),radius=2,fill=(50,200,246,255))
d.text((685,449), 'FILMS  •  SERIES  •  TV',font=small,fill=(184,208,234,255))
assets = {
    'res/drawable/wazo_banner_v2.png': banner.convert('RGB'),
    'res/drawable/wazo_icon_v2.png': banner,  # TV home tile uses application icon, not only banner
}
image_bytes = {}
for name,im in assets.items():
    buf=io.BytesIO(); im.save(buf,'PNG',optimize=True)
    image_bytes[name]=buf.getvalue()
# The existing versionName is a fixed-length UTF-16LE attribute.
old='2.5.2'.encode('utf-16le')
new='2.5.4'.encode('utf-16le')
assert manifest.count(old)==1
manifest=manifest.replace(old,new)
unsigned = OUT/'WazoTV_2.5.4_unsigned.apk'
aligned = OUT/'WazoTV_2.5.4_aligned.apk'
signed = OUT/'WazoTV_2.5.4.apk'
with zipfile.ZipFile(SOURCE) as src,zipfile.ZipFile(unsigned,'w') as dst:
    for member in src.infolist():
        if member.filename.startswith('META-INF/'):
            continue
        data=image_bytes.get(member.filename)
        if data is None:
            data=manifest if member.filename=='AndroidManifest.xml' else src.read(member.filename)
        dst.writestr(member,data)
subprocess.run([str(SDK/'zipalign'),'-f','-p','4',str(unsigned),str(aligned)],check=True)
env=dict(os.environ,JAVA_HOME=JAVA_HOME,PATH=JAVA_HOME+'/bin:'+os.environ.get('PATH',''))
subprocess.run([str(SDK/'apksigner'),'sign','--ks',str(KEY),
                '--ks-key-alias','androiddebugkey','--ks-pass','pass:android',
                '--key-pass','pass:android','--out',str(signed),str(aligned)],check=True,env=env)
subprocess.run([str(SDK/'apksigner'),'verify','--print-certs',str(signed)],check=True,env=env)
print('APK=',signed)
print('SHA256=',hashlib.sha256(signed.read_bytes()).hexdigest())
print('BANNER=',banner.size,'ICON=',assets['res/drawable/wazo_icon_v2.png'].size)
