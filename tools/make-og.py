"""Builds public/og.png (1200x630), the image shown when the site is shared on WhatsApp, X, Instagram and so on.
Run: python3 tools/make-og.py   (needs Pillow). Uses three of the daily frames, so rebuild after changing them."""
import glob, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630
BG, RED, TEXT, MUTED = (16, 12, 13), (237, 41, 62), (243, 236, 232), (185, 174, 170)
font = lambda size, bold=True: ImageFont.truetype('/usr/share/fonts/truetype/google-fonts/Poppins-%s.ttf' % ('Bold' if bold else 'Medium'), size)

img = Image.new('RGB', (W, H), BG)
glow = Image.new('RGB', (W, H), BG)
ImageDraw.Draw(glow).ellipse((600, -200, 1400, 500), fill=(70, 14, 24))
img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(120)), .9)

frames = sorted(glob.glob('public/media/daily/*-1.jpg'))
random.Random(7).shuffle(frames)
for i, (x, y, w, angle) in enumerate([(690, 60, 360, -7), (740, 235, 360, 4), (650, 400, 360, -3)]):
    shot = Image.open(frames[i]).convert('RGB')
    shot = shot.resize((w, int(w * shot.height / shot.width)))
    card = Image.new('RGB', (w + 16, shot.height + 16), (243, 236, 232))
    card.paste(shot, (8, 8))
    card = card.convert('RGBA').rotate(angle, expand=True, resample=Image.BICUBIC)
    shadow = Image.new('RGBA', card.size, (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 140), mask=card.split()[3])
    img.paste(shadow.filter(ImageFilter.GaussianBlur(14)), (x + 8, y + 12), shadow.filter(ImageFilter.GaussianBlur(14)))
    img.paste(card, (x, y), card)

d = ImageDraw.Draw(img)
d.rounded_rectangle((70, 70, 118, 118), 10, fill=RED)
d.polygon([(87, 84), (87, 104), (104, 94)], fill=(255, 255, 255))
d.text((134, 76), 'Movie Games', font=font(34), fill=TEXT)
d.text((134 + d.textlength('Movie Games ', font=font(34)), 76), 'Daily', font=font(34), fill=(255, 138, 150))
d.text((70, 200), 'Daily Telugu', font=font(78), fill=TEXT)
d.text((70, 290), 'movie games', font=font(78), fill=TEXT)
d.text((70, 408), 'Frames  ·  Dialogues  ·  7 questions', font=font(32, False), fill=MUTED)
d.rounded_rectangle((70, 480, 420, 548), 12, fill=RED)
d.text((98, 495), 'A new quiz every day', font=font(26), fill=(255, 255, 255))
img.save('public/og.png', optimize=True)
print('public/og.png', img.size)
