#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""پات کلاب • Putt Club Golf Academy — standalone single-file builder.
Inlines CSS/JS and embeds local raster assets as WebP data-URIs (offline-capable)."""
import base64, io, os, re, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.abspath(__file__))

# asset -> (max width, WebP quality) — keep small for sprites, larger for hero/login
SIZES = {
    'login_bg.webp':    (1400, 78),
    'hero_main.webp':   (1200, 80),
    'course_pano.webp': (1100, 78),
    'ball_3d.webp':     (520, 84),
    'trophy_3d.webp':   (520, 84),
    'flag_3d.webp':     (420, 84),
    'avatar_m.webp':    (280, 82),
    'avatar_f.webp':    (280, 82),
    'puttclub_favicon.webp': (128, 92),
    'puttclub_logo.webp':   (340, 84),
    'lobby_bg_v3.webp': (1536, 82),
    'shop_hero.webp':   (1280, 80),
    'open_tee.webp':    (1100, 82),
    'open_swing.webp':  (1100, 82),
    'open_sky.webp':    (1100, 82),
    'open_hole.webp':    (1100, 82),
}

def img_uri(name):
    path = os.path.join(ROOT, 'assets', name)
    if not os.path.exists(path):
        print('  ! missing asset', name); return None
    w, q = SIZES.get(name, (900, 82))
    im = ImageOps.exif_transpose(Image.open(path))
    if im.width > w:
        im = im.resize((w, max(1, int(im.height * w / im.width))), Image.Resampling.LANCZOS)
    has_alpha = 'A' in im.getbands() or 'transparency' in im.info
    im = im.convert('RGBA' if has_alpha else 'RGB')
    buf = io.BytesIO()
    lossless = name in {'puttclub_logo.webp', 'puttclub_favicon.webp'}
    im.save(buf, 'WEBP', quality=q, method=6, lossless=lossless)
    data = buf.getvalue()
    print(f'  {name}: {os.path.getsize(path)//1024}KB -> {len(data)//1024}KB ({im.width}x{im.height})')
    return 'data:image/webp;base64,' + base64.b64encode(data).decode()

def main():
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

    # 1) drop external font preconnect
    html = re.sub(r'<link rel="preconnect"[^>]*>', '', html)

    # 2) inline CSS
    css = open(os.path.join(ROOT, 'css', 'style.css'), encoding='utf-8').read()
    html = re.sub(r'<link rel="stylesheet" href="css/style.css">',
                  '<style>' + css + '</style>', html)
    if os.path.exists(os.path.join(ROOT, 'css', 'shop.css')):
        scss = open(os.path.join(ROOT, 'css', 'shop.css'), encoding='utf-8').read()
        html = re.sub(r'<link rel="stylesheet" href="css/shop.css">',
                      '<style>' + scss + '</style>', html)
    if os.path.exists(os.path.join(ROOT, 'css', 'mgmt.css')):
        mcss = open(os.path.join(ROOT, 'css', 'mgmt.css'), encoding='utf-8').read()
        html = re.sub(r'<link rel="stylesheet" href="css/mgmt.css">',
                      '<style>' + mcss + '</style>', html)
    if os.path.exists(os.path.join(ROOT, 'css', 'rank-guide.css')):
        rcss = open(os.path.join(ROOT, 'css', 'rank-guide.css'), encoding='utf-8').read()
        html = re.sub(r'<link rel="stylesheet" href="css/rank-guide.css">',
                      lambda m: '<style>' + rcss + '</style>', html)
    if os.path.exists(os.path.join(ROOT, 'css', 'avatarland.css')):
        alcss = open(os.path.join(ROOT, 'css', 'avatarland.css'), encoding='utf-8').read()
        html = re.sub(r'<link rel="stylesheet" href="css/avatarland.css">',
                      '<style>' + alcss + '</style>', html)
    if os.path.exists(os.path.join(ROOT, 'css', 'phone.css')):
        pcss = open(os.path.join(ROOT, 'css', 'phone.css'), encoding='utf-8').read()
        html = re.sub(r'<link rel="stylesheet" href="css/phone.css">',
                      '<style>' + pcss + '</style>', html)
    if os.path.exists(os.path.join(ROOT, 'css', 'leaflet.css')):
        lcss = open(os.path.join(ROOT, 'css', 'leaflet.css'), encoding='utf-8').read()
        html = re.sub(r'<link rel="stylesheet" href="css/leaflet.css">',
                      '<style>' + lcss + '</style>', html)

    # 3) inline JS in load order
    for jsname in ['device', 'auth', 'cloud', 'labels', 'holidays', 'data', 'brand', 'sub', 'charts', 'qrcode.min', 'qr-webp', 'battle', 'landing', 'jdate', 'avatar', 'rank-guide', 'shop', 'mgmt', 'smartplay', 'leaflet', 'mis-golf', 'coursegeo', 'earthshot', 'earthmap', 'ga-backup', 'app']:
        js = open(os.path.join(ROOT, 'js', jsname + '.js'), encoding='utf-8').read()
        html = re.sub(rf'<script src="js/{jsname}\.js"></script>',
                      lambda m: '<script>' + js + '</script>', html)

    # 4) assets -> base64 WebP, replacing every literal reference (html + js)
    for name in SIZES:
        uri = img_uri(name)
        if not uri: continue
        # Only rewrite a relative asset path; keep canonical absolute metadata URLs intact.
        asset_ref = re.compile(r'(?<![A-Za-z0-9._~/-])assets/' + re.escape(name) + r'(?![A-Za-z0-9._-])')
        html = asset_ref.sub(lambda m: uri, html)

    out = os.path.join(ROOT, 'GolfAcademy_PRO.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'\nwritten {out} — {os.path.getsize(out)//1024} KB')

if __name__ == '__main__':
    main()
