#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""GolfAcademy PRO — standalone single-file builder.
Inlines CSS/JS and compresses assets to JPEG data-URIs (offline-capable)."""
import base64, io, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))

# asset -> (max width, jpeg quality) — keep small for sprites, larger for hero/login
SIZES = {
    'login_bg.webp':    (1400, 72),
    'hero_main.webp':   (1200, 74),
    'course_pano.webp': (1100, 72),
    'ball_3d.webp':     (520, 80),
    'trophy_3d.webp':   (520, 80),
    'flag_3d.webp':     (420, 82),
    'avatar_m.webp':    (280, 84),
    'avatar_f.webp':    (280, 84),
    'lobby_bg_v3.webp': (1536, 92),
    'shop_hero.webp':   (1280, 78),
    'open_tee.webp':    (1100, 84),
    'open_swing.webp':  (1100, 84),
    'open_sky.webp':    (1100, 84),
    'open_hole.webp':   (1100, 84),
}

def img_uri(name):
    path = os.path.join(ROOT, 'assets', name)
    if not os.path.exists(path):
        print('  ! missing asset', name); return None
    w, q = SIZES.get(name, (900, 76))
    im = Image.open(path).convert('RGB')
    if im.width > w:
        im = im.resize((w, int(im.height * w / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=q, optimize=True)
    data = buf.getvalue()
    print(f'  {name}: {os.path.getsize(path)//1024}KB -> {len(data)//1024}KB ({im.width}x{im.height})')
    return 'data:image/jpeg;base64,' + base64.b64encode(data).decode()

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
    if os.path.exists(os.path.join(ROOT, 'css', 'avatarland.css')):
        alcss = open(os.path.join(ROOT, 'css', 'avatarland.css'), encoding='utf-8').read()
        html = re.sub(r'<link rel="stylesheet" href="css/avatarland.css">',
                      '<style>' + alcss + '</style>', html)

    # 3) inline JS in load order
    for jsname in ['cloud', 'labels', 'holidays', 'data', 'charts', 'qrcode.min', 'battle', 'landing', 'jdate', 'avatar', 'shop', 'mgmt', 'smartplay', 'app']:
        js = open(os.path.join(ROOT, 'js', jsname + '.js'), encoding='utf-8').read()
        html = re.sub(rf'<script src="js/{jsname}\.js"></script>',
                      lambda m: '<script>' + js + '</script>', html)

    # 4) assets -> base64 JPEG, replacing every literal reference (html + js)
    for name in SIZES:
        uri = img_uri(name)
        if not uri: continue
        html = html.replace(f'assets/{name}', uri)

    out = os.path.join(ROOT, 'GolfAcademy_PRO.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'\nwritten {out} — {os.path.getsize(out)//1024} KB')

if __name__ == '__main__':
    main()
