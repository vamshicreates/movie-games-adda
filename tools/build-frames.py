"""Builds the Guess the Movie levels from images_with_dialogues/.

Keeps only clearly visible frames (no black bars, not dark or flat; each post stacks two frames of one scene), skips template/promo posts, resizes the pictures into
public/media/frames/ and writes frames-data.js (ten distinct movies per level).
Run:  python3 tools/build-frames.py
"""
import glob, json, os, random, re, collections
import numpy as np
from PIL import Image

SRC = 'images_with_dialogues'
OUT = 'public/media/frames'
CAP = 4          # most frames any one movie contributes
MAX_LEVELS = 24

# folder key (lower case) -> (movie shown, other accepted names)
M = {
 'avpl': ('Ala Vaikunthapurramuloo', ['AVPL', 'Ala Vaikunthapuramulo', 'Ala Vaikuntapuramlo', 'Ala Vaikunthapurramulo']),
 'khaleja': ('Khaleja', []), 'sln': ('Sarileru Neekevvaru', ['SLN', 'Sarileru Nekevvaru', 'Sarileru Neekevaru']),
 'athadu': ('Athadu', []), 'jalsa': ('Jalsa', []), 'manmadhudu': ('Manmadhudu', ['Manmathudu']),
 'adhurs': ('Adhurs', []), 'sonofsatyamurthy': ('S/O Satyamurthy', ['Son of Satyamurthy', 'Son Of Satyamoorthy', 'Satyamurthy']),
 'nuvvunaakunachav': ('Nuvvu Naaku Nachav', ['Nuvvu Naku Nachav', 'Nuvvu Nachav']),
 'king': ('King', []), 'julayi': ('Julayi', ['Julai']), 'ene': ('Ee Nagaraniki Emaindi', ['ENE', 'Ee Nagaraniki Emayindi', 'Ee Nagaraniki']),
 'venky': ('Venky', []), 'jaathiratnalu': ('Jathi Ratnalu', ['Jaathi Ratnalu', 'Jathiratnalu', 'Jathi Rathnalu']),
 'raghuvaranbtech': ('Raghuvaran B.Tech', ['VIP', 'Raghuvaran BTech', 'Raghuvaran B Tech', 'Velaiilla Pattadhari']),
 'kick': ('Kick', []), 'businessman': ('Businessman', []), 'arjunreddy': ('Arjun Reddy', []), 'master': ('Master', []),
 'sivaji': ('Sivaji', ['Sivaji The Boss', 'Shivaji']), 'attarintikidaredhi': ('Attarintiki Daredi', ['Attarintiki Daredhi', 'Attarintiki Dharedi', 'ATD']),
 'rajarani': ('Raja Rani', []), 'sontam': ('Sontham', ['Sontam']),
 'svsc': ('Seethamma Vakitlo Sirimalle Chettu', ['SVSC', 'Seethamma Vakitlo', 'Seetamma Vakitlo']),
 'v': ('V', []), 'dookudu': ('Dookudu', []), 'f2': ('F2', ['F2 Fun and Frustration']), 'neninthe': ('Neninthe', []),
 'pokiri': ('Pokiri', []), 'beeshma': ('Bheeshma', ['Beeshma']),
 'asvr': ('Aravindha Sametha Veera Raghava', ['Aravinda Sametha', 'Aravinda Sametha Veera Raghava', 'ASVR', 'Aravindha Sametha']),
 'aravindhasamethaveeraraghava': ('Aravindha Sametha Veera Raghava', ['Aravinda Sametha', 'Aravinda Sametha Veera Raghava', 'ASVR', 'Aravindha Sametha']),
 'colourphoto': ('Colour Photo', ['Colourphoto', 'Color Photo']), 'pellichoopulu': ('Pelli Choopulu', ['Pellichoopulu', 'Pelli Chupulu']),
 'gabbarsingh': ('Gabbar Singh', []), 'aparichitudu': ('Aparichitudu', ['Anniyan', 'Aparichithudu']),
 'mathuvadhalara': ('Mathu Vadalara', ['Mathu Vadhalara']), 'sbsb': ('Solo Brathuke So Better', ['SBSB', 'Solo Bratuke So Better', 'Solo Brathuke']),
 'ready': ('Ready', []), 'mirchi': ('Mirchi', []),
 'baahubali': ('Baahubali: The Beginning', ['Baahubali', 'Bahubali', 'Baahubali 1', 'Bahubali The Beginning']),
 'baahubali2': ('Baahubali 2: The Conclusion', ['Baahubali 2', 'Bahubali 2', 'Baahubali The Conclusion']),
 'chatrapathi': ('Chatrapathi', ['Chatrapati', 'Chhatrapathi']), 'parugu': ('Parugu', []), 'nuvvenuvve': ('Nuvve Nuvve', []),
 'anhr': ('Aakaasam Nee Haddhu Ra', ['ANHR', 'Soorarai Pottru', 'Akasam Nee Haddhu Ra', 'Aakasam Nee Haddhu Ra']),
 'puspha': ('Pushpa: The Rise', ['Pushpa', 'Pushpa 1', 'Puspha']), 'racegurram': ('Race Gurram', []),
 'robo': ('Robo', ['Enthiran', 'Endhiran']), 'srimanthudu': ('Srimanthudu', []), 'dubaiseenu': ('Dubai Seenu', []),
 'mcm': ('Middle Class Melodies', ['MCM']), 'lakshmi': ('Lakshmi', []),
 'pratirojupandage': ('Prati Roju Pandage', ['PRP', 'Prathi Roju Pandage', 'Prati Roju Pandaga']),
 'sarrainodu': ('Sarrainodu', ['Sarainodu']), 'darling': ('Darling', []), 'aaa': ('A Aa', ['A..Aa', 'Aa Aa']),
 'bommarillu': ('Bommarillu', []), 'rajavaaruranigaaru': ('Raja Vaaru Rani Gaaru', ['RVRG', 'Raja Varu Rani Garu']),
 'kgf': ('KGF', ['KGF Chapter 1', 'KGF Chapter 2']), 'mallishwari': ('Malliswari', ['Mallishwari']), 'sye': ('Sye', []),
 'jailavakusa': ('Jai Lava Kusa', ['JLK', 'Jailavakusa']), 'bujjigaadu': ('Bujjigadu', ['Bujjigaadu']),
 'gangleader': ('Gang Leader', []), 'saaho': ('Saaho', []), 'vikramarkudu': ('Vikramarkudu', []), 'rangasthalam': ('Rangasthalam', []),
 'krishna': ('Krishna', []), 'uppena': ('Uppena', []),
 '7gbrindavancolony': ('7/G Brindavan Colony', ['7G Brindavan Colony', '7 G Brindavan Colony', '7G']),
 'legend': ('Legend', []), 'idiot': ('Idiot', []), 'pillazamindar': ('Pilla Zamindar', []), 'dhee': ('Dhee', []),
 'spyder': ('Spyder', []), 'georgereddy': ('George Reddy', []), 'anjaneyulu': ('Anjaneyulu', []),
 'hit': ('HIT: The First Case', ['HIT', 'Hit The First Case']), 'jersey': ('Jersey', []), 'mahanati': ('Mahanati', []),
 'geethagovindam': ('Geetha Govindam', []), 'careofkancharapalem': ('C/o Kancharapalem', ['Care of Kancharapalem', 'Kancharapalem', 'CoKCP']),
 'temper': ('Temper', []), 'padipadilechemanasu': ('Padi Padi Leche Manasu', ['PPLM']), 'rajathegreat': ('Raja the Great', []),
 'mirapakai': ('Mirapakay', ['Mirapakai']), 'vedam': ('Vedam', []), 'tagore': ('Tagore', []), 'gamyam': ('Gamyam', []),
 'baadshah': ('Baadshah', ['Badshah']), '90ml': ('90ML', []), 'darbar': ('Darbar', []), 'krack': ('Krack', []),
 'vakeelsaab': ('Vakeel Saab', []), 'narappa': ('Narappa', []), 'sarpattaparambarai': ('Sarpatta Parambarai', []), 'jaanu': ('Jaanu', []),
}
# Movies whose names are easy to confuse never share a level.
FAMILY = {'baahubali': 'bahu', 'baahubali2': 'bahu', 'rajarani': 'raja', 'rajavaaruranigaaru': 'raja', 'rajathegreat': 'raja',
          'nuvvunaakunachav': 'nuvv', 'nuvvenuvve': 'nuvv', 'asvr': 'asvr', 'aravindhasamethaveeraraghava': 'asvr'}
BAD_DIALOGUE = re.compile(r'template|pre-?release|launch|trending|\bpic\b|follower|epic walk|smile$', re.I)

def clean(text):
    text = re.sub(r'\s+', ' ', text.replace('**', '')).strip()
    if len(text) > 330:
        text = text[:330].rsplit(' ', 1)[0].rstrip('.,;: ') + '…'
    return text

def lead(flags):
    n = 0
    for f in flags:
        if not f: break
        n += 1
    return n

def clear_half(gray):
    """One frame of the post: no black bars, not too dark, not flat, not mostly shadow."""
    small = np.asarray(Image.fromarray(gray).resize((96, 54)), dtype=float)
    rows, cols = small.mean(axis=1) < 16, small.mean(axis=0) < 16
    bars = max(lead(rows), lead(rows[::-1]), lead(cols), lead(cols[::-1]))
    return bars <= 1 and small.mean() >= 60 and small.mean() <= 205 and small.std() >= 38 and (small < 30).mean() < 0.25

def longest(flags):
    best = run = 0
    for f in flags:
        run = run + 1 if f else 0
        best = max(best, run)
    return best

def full_frame(path):
    """Each post is a collage of 2-6 frames of one scene. No black band may sit anywhere in it
    (edges or between frames), and every half must be bright and detailed enough to read."""
    a = np.asarray(Image.open(path).convert('L'))
    h, w = a.shape
    grid = np.asarray(Image.fromarray(a).resize((144, 144)), dtype=float)
    if longest(grid.mean(axis=1) < 16) >= 3 or longest(grid.mean(axis=0) < 16) >= 3: return False
    halves = [a] if h / w < 0.7 else [a[:h // 2], a[h // 2:]]
    return all(clear_half(np.ascontiguousarray(x)) for x in halves)

pool = collections.defaultdict(list)
for txt in sorted(glob.glob(f'{SRC}/*.txt')):
    jpg = txt[:-4] + '.jpg'
    if not os.path.exists(jpg) or '_slide' in jpg: continue
    meta = {}
    for line in open(txt, encoding='utf-8', errors='ignore'):
        if line.startswith('Full Caption'): break
        if ':' in line:
            k, v = line.split(':', 1); meta[k.strip()] = v.strip()
    key = meta.get('Film', '').lower()
    dialogue = clean(meta.get('Dialogue', ''))
    if key not in M or len(dialogue.split()) < 3 or BAD_DIALOGUE.search(dialogue): continue
    if not full_frame(jpg): continue
    pool[M[key][0]].append(dict(key=key, jpg=jpg, dialogue=dialogue))

rng = random.Random(2898)
for frames in pool.values(): rng.shuffle(frames)
films = {name: frames for name, frames in pool.items() if len(frames) >= 4}
quota = {name: min(CAP, len(frames)) for name, frames in films.items()}
levels = []
while len(levels) < MAX_LEVELS:
    order = sorted(quota, key=lambda n: (-quota[n], rng.random()))
    chosen, families = [], set()
    for name in order:
        if quota[name] <= 0: break
        fam = FAMILY.get(films[name][0]['key'], name)
        if fam in families: continue
        chosen.append(name); families.add(fam)
        if len(chosen) == 10: break
    if len(chosen) < 10: break
    for name in chosen: quota[name] -= 1
    levels.append(chosen)

os.makedirs(OUT, exist_ok=True)
for old in glob.glob(f'{OUT}/*.jpg'):
    try: os.remove(old)
    except OSError: pass   # files are simply overwritten below
used = collections.Counter(); n = 0; data = []
for chosen in levels:
    rng.shuffle(chosen); level = []
    for name in chosen:
        item = films[name][used[name]]; used[name] += 1; n += 1
        im = Image.open(item['jpg']).convert('RGB'); im.thumbnail((900, 900), Image.LANCZOS)
        im.save(f'{OUT}/f-{n:03d}.jpg', quality=74, optimize=True, progressive=True)
        level.append(dict(file=f'f-{n:03d}.jpg', movie=name, aliases=M[item['key']][1], dialogue=item['dialogue']))
    data.append(level)
with open('frames-data.js', 'w', encoding='utf-8') as f:
    f.write('// Generated by tools/build-frames.py from images_with_dialogues/. Do not edit by hand.\n')
    f.write('export const frameLevels = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
print(len(pool), 'movies with frames;', len(films), 'used;', len(data), 'levels;', n, 'images')
