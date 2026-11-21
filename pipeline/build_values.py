"""League-weighted 2026 player values for Beat Jeff.

Scores every 2026 MLB hitter (150+ AB) and pitcher (20+ IP) on this league's 12 categories.
Each category is a z-score against a pool of roughly rosterable players; rate stats are scaled by
playing time. Categories are weighted 0.5 + (correlation of that category's win rate with overall
win rate, 2023-26). Output: ../public/data/values.json
"""
import json, unicodedata, re, csv, statistics as st, collections

CORR = {'R': .47, 'HR': .39, 'RBI': .46, 'SB': .33, 'AVG': .28, 'OPS': .62,
        'W': .31, 'SV': .03, 'K': .28, 'ERA': .49, 'WHIP': .57, 'KBB': .41}
W = {k: round(.5 + v, 2) for k, v in CORR.items()}
HCATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS']
PCATS = ['W', 'SV', 'K', 'ERA', 'WHIP', 'KBB']

def norm(n):
    n = unicodedata.normalize('NFKD', n).encode('ascii', 'ignore').decode().lower()
    n = re.sub(r'\(.*?\)', '', n)
    n = re.sub(r'\b(jr|sr|ii|iii)\b\.?', '', n)
    return re.sub(r'[^a-z]', '', n)

def ip_of(s):
    a, _, b = str(s).partition('.')
    return int(a) + (int(b or 0)) / 3

TEAMS = json.load(open('raw/mlb/teams.json'))
def team(s): n = s.get('team', {}).get('name', ''); return TEAMS.get(n, n)

def load(g):
    return json.load(open(f'raw/mlb/{g}_2026.json'))['stats'][0]['splits']

# ---------- position eligibility (Yahoo: 5 starts or 10 games at a position) ----------
fpos = collections.defaultdict(lambda: collections.Counter())
fgs = collections.defaultdict(lambda: collections.Counter())
MAP = {'C': 'C', '1B': '1B', '2B': '2B', '3B': '3B', 'SS': 'SS', 'LF': 'OF', 'CF': 'OF', 'RF': 'OF'}
for s in load('fielding'):
    p = MAP.get(s['position']['abbreviation'])
    if not p: continue
    pid = s['player']['id']
    fpos[pid][p] += s['stat'].get('games', s['stat'].get('gamesPlayed', 0))
    fgs[pid][p] += s['stat'].get('gamesStarted', 0)

def hitter_pos(pid):
    out = [p for p in ['C', '1B', '2B', '3B', 'SS', 'OF'] if fgs[pid][p] >= 5 or fpos[pid][p] >= 10]
    return out or ['Util']

# ---------- hitters ----------
H = []
for s in load('hitting'):
    t = s['stat']; ab = t.get('atBats', 0)
    if ab < 150: continue
    H.append(dict(id=s['player']['id'], name=s['player']['fullName'], team=team(s),
                  ab=ab, pa=t['plateAppearances'], R=t['runs'], HR=t['homeRuns'], RBI=t['rbi'], SB=t['stolenBases'],
                  AVG=float(t['avg']), OPS=float(t['ops']), OBP=float(t['obp']), SLG=float(t['slg']), g=t['gamesPlayed']))
# ---------- pitchers ----------
P = []
for s in load('pitching'):
    t = s['stat']; ip = ip_of(t['inningsPitched'])
    if ip < 20: continue
    bb = t['baseOnBalls']
    P.append(dict(id=s['player']['id'], name=s['player']['fullName'], team=team(s),
                  ip=ip, ipDisp=t['inningsPitched'], W=t['wins'], SV=t['saves'], K=t['strikeOuts'], BB=bb,
                  ERA=float(t['era']), WHIP=float(t['whip']), KBB=round(t['strikeOuts'] / bb, 2) if bb else float(t['strikeOuts']),
                  gs=t['gamesStarted'], g=t['gamesPitched'], HLD=t.get('holds', 0)))
for p in P:
    roles = []
    if p['gs'] >= 5: roles.append('SP')
    if p['g'] - p['gs'] >= 10: roles.append('RP')
    p['pos'] = roles or (['SP'] if p['gs'] >= p['g'] / 2 else ['RP'])

def score(pool_h, pool_p, h, p):
    abm = st.mean(x['ab'] for x in pool_h); ipm = st.mean(x['ip'] for x in pool_p)
    mavg = st.mean(x['AVG'] for x in pool_h); mops = st.mean(x['OPS'] for x in pool_h)
    mera = st.mean(x['ERA'] for x in pool_p); mwhip = st.mean(x['WHIP'] for x in pool_p)
    mkbb = st.mean(min(x['KBB'], 8) for x in pool_p)
    def hraw(x): return {'R': x['R'], 'HR': x['HR'], 'RBI': x['RBI'], 'SB': x['SB'],
                         'AVG': (x['AVG'] - mavg) * x['ab'] / abm, 'OPS': (x['OPS'] - mops) * x['ab'] / abm}
    def praw(x): return {'W': x['W'], 'SV': x['SV'], 'K': x['K'], 'ERA': -(x['ERA'] - mera) * x['ip'] / ipm,
                         'WHIP': -(x['WHIP'] - mwhip) * x['ip'] / ipm, 'KBB': (min(x['KBB'], 8) - mkbb) * x['ip'] / ipm}
    hstats = {c: (st.mean(hraw(x)[c] for x in pool_h), st.pstdev(hraw(x)[c] for x in pool_h)) for c in HCATS}
    pstats = {c: (st.mean(praw(x)[c] for x in pool_p), st.pstdev(praw(x)[c] for x in pool_p)) for c in PCATS}
    for x in h:
        r = hraw(x); x['z'] = {c: round((r[c] - hstats[c][0]) / hstats[c][1], 2) for c in HCATS}
    for x in p:
        r = praw(x); x['z'] = {c: round((r[c] - pstats[c][0]) / pstats[c][1], 2) for c in PCATS}
    for x in h + p:
        x['value'] = round(sum(W[c] * v for c, v in x['z'].items()), 2)
        x['equal'] = round(sum(x['z'].values()), 2)

# two passes: pool = top 180 of each by previous pass
score([x for x in H if x['ab'] >= 300], [x for x in P if x['ip'] >= 40], H, P)
for _ in range(2):
    ph = sorted(H, key=lambda x: -x['value'])[:180]; pp = sorted(P, key=lambda x: -x['value'])[:180]
    score(ph, pp, H, P)

for x in H: x['pos'] = hitter_pos(x['id'])

# ---------- outside ranks ----------
nbc = {}
for i, line in enumerate(open('ext/nbc_top150.txt'), 1):
    n, pos = line.strip().split('|')
    key = norm(n) + ('#P' if '(Pitcher)' in n else '')
    nbc[key] = i
pl = {norm(l.strip()): i for i, l in enumerate(open('ext/pl_sp200.txt'), 1)}
yr = {}
for r in csv.DictReader(open('data/players.csv')):
    if r['season'] == '2026':
        k = norm(r['player']) + ('#P' if r['group'] == 'P' and 'Ohtani' in r['player'] else '')
        yr.setdefault((k, r['group']), (int(r['actual_rank']), r['owner_end']))

def finish(lst, grp, top):
    lst.sort(key=lambda x: -x['value'])
    for i, x in enumerate(lst, 1): x['rank'] = i
    for i, x in enumerate(sorted(lst, key=lambda x: -x['equal']), 1): x['equalRank'] = i
    out = []
    for x in lst[:top]:
        k = norm(x['name']); kp = k + '#P' if grp == 'P' and 'Ohtani' in x['name'] else k
        y = yr.get((kp if grp == 'P' else k, grp))
        row = {kk: x[kk] for kk in x if kk not in ('z',)}
        row['z'] = x['z']
        row['nbc'] = nbc.get(kp if grp == 'P' else k)
        if grp == 'P': row['pl'] = pl.get(k)
        row['yahoo'] = y[0] if y else None
        row['owner'] = y[1] if y else None
        row['small'] = (x['ab'] < 300) if grp == 'B' else (x['ip'] < 40 if 'RP' in x['pos'] and 'SP' not in x['pos'] else x['ip'] < 80)
        if grp == 'P' and 'Ohtani' in x['name']: row['name'] = 'Shohei Ohtani (Pitcher)'
        if grp == 'B' and 'Ohtani' in x['name']: row['name'] = 'Shohei Ohtani (Batter)'
        out.append(row)
    return out

data = {'asOf': '2026 regular season (MLB Stats API)', 'weights': W, 'corr': CORR,
        'hitters': finish(H, 'B', 250), 'pitchers': finish(P, 'P', 250)}
# compact pool of everyone scored, for the draft board and trade checker
data['pool'] = [{'name': ('Shohei Ohtani (Batter)' if 'Ohtani' in x['name'] else x['name']), 'g': 'B', 'pos': x['pos'], 'team': x['team'], 'value': x['value'], 'rank': x['rank'], 'z': x['z']} for x in H] + \
               [{'name': ('Shohei Ohtani (Pitcher)' if 'Ohtani' in x['name'] else x['name']), 'g': 'P', 'pos': x['pos'], 'team': x['team'], 'value': x['value'], 'rank': x['rank'], 'z': x['z']} for x in P]
import os; os.makedirs('../public/data', exist_ok=True)
json.dump(data, open('../public/data/values.json', 'w'), separators=(',', ':'))
print('hitters', len(data['hitters']), 'pitchers', len(data['pitchers']))
for x in data['hitters'][:15]: print(x['rank'], x['name'], x['pos'], x['value'], 'nbc', x['nbc'], 'yahoo', x['yahoo'])
for x in data['pitchers'][:15]: print(x['rank'], x['name'], x['pos'], x['value'], 'pl', x['pl'], 'nbc', x['nbc'])
print('unmatched nbc', [n for n in nbc if not any(norm(x['name']) == n.replace('#P','') for x in data['hitters'] + data['pitchers'])])
