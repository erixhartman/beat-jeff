"""2027 draft board pool: every scored 2026 player plus anyone on the NBC top 150 or Pitcher List SP 200.
Estimated draft slot = NBC rank where ranked; otherwise an estimate (see note in the site). -> ../public/data/board.json"""
import json, re, unicodedata

def norm(n):
    n = unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode().lower()
    n = re.sub(r'\b(jr|sr|ii|iii)\b\.?', '', n)
    return re.sub(r'[^a-z()]', '', n)

V = json.load(open('../public/data/values.json'))
pool = {}
for x in V['pool']:
    pool[(norm(x['name']), x['g'])] = dict(x)
nbc = []
for i, line in enumerate(open('ext/nbc_top150.txt'), 1):
    n, pos = line.strip().split('|'); nbc.append((i, n, pos))
pl = [(i, l.strip()) for i, l in enumerate(open('ext/pl_sp200.txt'), 1)]

def find(name, g):
    k = norm(name)
    if 'ohtani' in k: k = norm('Shohei Ohtani (Pitcher)') if g == 'P' else norm('Shohei Ohtani (Batter)')
    return pool.get((k, g))

board = {}
def get(name, g, pos=None):
    hit = find(name, g)
    key = (norm(hit['name']) if hit else norm(name), g)
    if key not in board:
        board[key] = hit or {'name': name, 'g': g, 'pos': [pos] if pos else (['SP'] if g == 'P' else ['Util']), 'team': '', 'value': None, 'rank': None, 'z': None}
    return board[key]

for i, n, pos in nbc:
    g = 'P' if pos in ('SP', 'RP') else 'B'
    if n == 'Shohei Ohtani (Pitcher)': n, g = 'Shohei Ohtani', 'P'
    get(n, g, pos)['nbc'] = i
for i, n in pl:
    get(n, 'P', 'SP')['pl'] = i
# keep the top 300 hitters and 250 pitchers by 2026 value too
for x in sorted([v for v in pool.values() if v['g'] == 'B'], key=lambda v: v['rank'])[:300]: get(x['name'], 'B')
for x in sorted([v for v in pool.values() if v['g'] == 'P'], key=lambda v: v['rank'])[:250]: get(x['name'], 'P')

rows = list(board.values())
# estimated pick: NBC rank; SPs outside it by Pitcher List order (about 1 in 3 picks after 150 is an SP); everyone else after 150 by 2026 value
for r in rows:
    if r.get('nbc'): r['est'] = r['nbc']; r['estFrom'] = 'NBC'
    elif r.get('pl'): r['est'] = 150 + max(1, r['pl'] - 40) * 3  # NBC's top 150 holds about 40 SPs; r['estFrom'] = 'PL'
rest = sorted([r for r in rows if 'est' not in r and r['value'] is not None], key=lambda r: -r['value'])
for i, r in enumerate(rest): r['est'] = 155 + i * 2; r['estFrom'] = '2026 value'
for r in rows:
    if 'est' not in r: r['est'] = 400; r['estFrom'] = 'none'
rows.sort(key=lambda r: r['est'])
json.dump({'players': rows}, open('../public/data/board.json', 'w'), separators=(',', ':'))
print(len(rows), sum(1 for r in rows if r['value'] is None), 'without 2026 value')
print([ (r['name'], r['est'], r['estFrom']) for r in rows[:5]], [(r['name'],r['est']) for r in rows if r.get('pl')==60])
