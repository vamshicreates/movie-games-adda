"""Builds the daily games' data from images_with_dialogues/ (additive: does not touch the level games).

Stage 1  scan   python3 tools/build-daily.py scan <shard> <shards> [cache_dir]
         Classifies every candidate still (clear, no black bars) and caches the answer.
Stage 2  build  python3 tools/build-daily.py build [cache_dir]
         Picks up to 4 clear stills and up to 3 dialogue lines per film, resizes them into
         public/media/daily/, merges tools/film-facts.json and writes daily-data.js.
"""
import glob, json, os, random, re, sys, collections
import numpy as np
from PIL import Image

SRC = 'images_with_dialogues'
OUT = 'public/media/daily'
MAX_FRAMES = 4
MAX_LINES = 3
BAD_DIALOGUE = re.compile(r'template|pre-?release|launch|trending|\bpic\b|follower|epic walk|smile$', re.I)

src = open('tools/build-frames.py', encoding='utf-8').read()
M = {}
exec(re.search(r"M = \{.*?\n\}\n", src, re.S).group(0), {}, M)
M = M['M']

def clean(text):
    text = re.sub(r'\s+', ' ', text.replace('**', '')).strip()
    if len(text) > 240:
        text = text[:240].rsplit(' ', 1)[0].rstrip('.,;: ') + '…'
    return text

def lead(flags):
    n = 0
    for f in flags:
        if not f: break
        n += 1
    return n

def longest(flags):
    best = run = 0
    for f in flags:
        run = run + 1 if f else 0
        best = max(best, run)
    return best

def clear_half(gray):
    small = np.asarray(Image.fromarray(gray).resize((96, 54)), dtype=float)
    rows, cols = small.mean(axis=1) < 16, small.mean(axis=0) < 16
    bars = max(lead(rows), lead(rows[::-1]), lead(cols), lead(cols[::-1]))
    return bars <= 1 and small.mean() >= 60 and small.mean() <= 205 and small.std() >= 38 and (small < 30).mean() < 0.25

def full_frame(path):
    a = np.asarray(Image.open(path).convert('L'))
    h, w = a.shape
    grid = np.asarray(Image.fromarray(a).resize((144, 144)), dtype=float)
    if longest(grid.mean(axis=1) < 16) >= 3 or longest(grid.mean(axis=0) < 16) >= 3: return False
    halves = [a] if h / w < 0.7 else [a[:h // 2], a[h // 2:]]
    return all(clear_half(np.ascontiguousarray(x)) for x in halves)

def records():
    out = []
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
        out.append(dict(key=key, jpg=jpg, dialogue=dialogue, tags=[t.strip() for t in meta.get('Tags', '').split(',') if t.strip()]))
    return out

def scan(shard, shards, cache):
    os.makedirs(cache, exist_ok=True)
    path = f'{cache}/pass-{shard}.json'
    done = json.load(open(path)) if os.path.exists(path) else {}
    mine = [r for i, r in enumerate(records()) if i % shards == shard]
    for n, r in enumerate(mine):
        if r['jpg'] in done: continue
        done[r['jpg']] = bool(full_frame(r['jpg']))
        if n % 40 == 0: json.dump(done, open(path, 'w'))
    json.dump(done, open(path, 'w'))
    print(f'shard {shard}: {len(done)}/{len(mine)} classified')

def build(cache):
    passed = {}
    for p in glob.glob(f'{cache}/pass-*.json'): passed.update(json.load(open(p)))
    facts_path = 'tools/film-facts.json'
    facts = json.load(open(facts_path, encoding='utf-8')) if os.path.exists(facts_path) else {}
    rng = random.Random(4417)
    pool = collections.defaultdict(list)
    for r in records():
        pool[r['key']].append(r)
    os.makedirs(OUT, exist_ok=True)
    films, skipped = [], []
    for key, (title, aliases) in M.items():
        # Two keys can share a title (e.g. the Aravindha Sametha folders); merge them.
        if any(f['title'] == title for f in films): continue
        items = [r for k2, (t2, _) in M.items() if t2 == title for r in pool.get(k2, [])]
        good = [r for r in items if passed.get(r['jpg'])]
        rng.shuffle(good)
        if not good:
            skipped.append(title); continue
        fid = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
        frames = []
        for n, r in enumerate(good[:MAX_FRAMES], 1):
            name = f'{fid}-{n}.jpg'
            im = Image.open(r['jpg']).convert('RGB'); im.thumbnail((820, 820), Image.LANCZOS)
            im.save(f'{OUT}/{name}', quality=70, optimize=True, progressive=True)
            frames.append(name)
        lines, seen = [], set()
        for r in sorted(items, key=lambda r: abs(len(r['dialogue']) - 110)):
            d = r['dialogue']
            if d.lower() in seen: continue
            seen.add(d.lower()); lines.append(d)
            if len(lines) == MAX_LINES: break
        tagcount = collections.Counter(t for r in items for t in r['tags'])
        fact = facts.get(title, {})
        films.append(dict(id=fid, title=title, te=fact.get('te', ''), aliases=aliases, frames=frames, lines=lines,
                          year=fact.get('year'), hero=fact.get('hero', ''), director=fact.get('director', ''),
                          music=fact.get('music', ''), genres=fact.get('genres', []), lang=fact.get('lang', 'Telugu')))
    films.sort(key=lambda f: f['title'].lower())
    with open('daily-data.js', 'w', encoding='utf-8') as f:
        f.write('// Generated by tools/build-daily.py from images_with_dialogues/ and tools/film-facts.json.\n')
        f.write('// Server-side only: it holds the answers, so it is never served from public/.\n')
        f.write('export const dailyFilms = ' + json.dumps(films, ensure_ascii=False, indent=1) + ';\n')
    nofacts = [f['title'] for f in films if not f['year']]
    print(len(films), 'films;', sum(len(f['frames']) for f in films), 'frames; skipped (no clear still):', skipped)
    print('films without facts yet:', len(nofacts))

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'scan': scan(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4] if len(sys.argv) > 4 else os.path.expanduser('~/dd-cache'))
    elif cmd == 'build': build(sys.argv[2] if len(sys.argv) > 2 else os.path.expanduser('~/dd-cache'))
