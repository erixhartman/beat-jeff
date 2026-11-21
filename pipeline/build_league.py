"""League history, draft tendencies and scouting data for Beat Jeff -> ../public/data/league.json"""
import csv, json, collections, statistics as st, re

MGR = {
 2023: {"Winfield Wants Noise": "Jeff", "Scrap Heap Gold": "Chad", "The Golden Sombreros": "Jonny", "Eli's College Fund": "Daniel",
        "Home Run Furby": "Ben U", "Operation Vamos": "Ben F", "Semien Retention": "Eric", "The Strahm Delusion": "Doug",
        "Gimme the Noot": "Colton", "Offensive Indifference": "Wes", "Loose Juice": "Unknown"},
 2024: {"Winfield Wants Noise": "Jeff", "Scrap Heap Gold": "Chad", "Golden Sombreros": "Jonny", "Eli's College Fund": "Daniel",
        "Operation Vamos": "Ben U", "Westle Mania": "Ben F", "My Sweet Lourdes": "Eric", "The Mendoza Line": "Doug",
        "A Drive By Castellanos": "Colton", "Kruk Yourself": "Wes", "Ahh Puckett": "Andy", "Hawks 26": "Lee & Stevie"},
 2025: {"Winfield Wants Noise": "Jeff", "Scrap Heap Gold": "Chad", "Golden Sombreros": "Jonny", "Eli's College Fund": "Daniel",
        "Home Run Furby": "Ben U", "Operation Vamos": "Ben F", "Make Em Say Uhh Suzuki": "Eric", "The Mets Suck Ass": "Doug",
        "Let Bygones Be Bygones": "Eugene", "O.M.G.": "Kyle", "Ahh Puckett": "Andy", "Hawks 26": "Lee & Stevie"},
 2026: {"Winfield Wants Noise": "Jeff", "Scrap Heap Gold": "Chad", "Golden Sombreros": "Jonny", "Eli's College Fund": "Daniel",
        "Home Run Furby": "Ben U", "Operation Vamos": "Ben F", "Bury my Bats at Wounded Knee": "Eric", "Ass in the Jackpot": "Doug",
        "Julio Down by the Schoolyard": "Eugene", "O.M.G.": "Kyle", "Ahh Puckett": "Andy", "Hawks 26": "Lee & Stevie"},
}
# the 2023 emoji team was Lee & Stevie
F = list(csv.DictReader(open('data/final_standings.csv')))
for r in F:
    if r['season'] == '2023' and r['team'] not in MGR[2023]: MGR[2023][r['team']] = 'Lee & Stevie'
TEAM2026 = {v: k for k, v in MGR[2026].items()}
ROSTER2027 = ['Jeff', 'Chad', 'Jonny', 'Daniel', 'Ben U', 'Ben F', 'Doug', 'Eugene', 'Wes', 'Andy', 'Lee & Stevie']

T = list(csv.DictReader(open('data/transactions.csv')))
TR = json.load(open('data/trades.json'))
D = list(csv.DictReader(open('data/draft.csv')))
P = {(r['season'], r['player']): r for r in csv.DictReader(open('data/players.csv'))}
C = list(csv.DictReader(open('data/category_records.csv')))
CATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'W', 'SV', 'K', 'ERA', 'WHIP', 'K/BB']

def m(season, team): return MGR[int(season)].get(team, 'Unknown')
def pct(s): w, l, t = map(int, s.split('-')); return (w + .5 * t) / (w + l + t)

def kind(season, player):
    r = P.get((str(season), player))
    if not r: return '?'
    if r['group'] == 'B': return 'H'
    try: sv = int(r['stats'].split(' / ')[2])
    except Exception: return 'SP'
    return 'RP' if sv >= 10 else 'SP'

def add_kind(pos):
    p = pos.split(' - ')[-1]
    if 'SP' in p and 'RP' not in p: return 'SP'
    if 'RP' in p and 'SP' not in p: return 'RP'
    if 'P' in p: return 'SP/RP'
    return 'H'

catrank = {}
for y in ['2023', '2024', '2025', '2026']:
    for c in CATS:
        v = sorted([(pct(r['w_l_t']), r['team']) for r in C if r['season'] == y and r['category'] == c], reverse=True)
        for i, (_, t) in enumerate(v, 1): catrank[(y, t, c)] = i

managers = {}
for y in [2023, 2024, 2025, 2026]:
    for team, who in MGR[y].items():
        fs = [r for r in F if r['season'] == str(y) and r['team'] == team]
        if not fs: continue
        adds = [r for r in T if r['season'] == str(y) and r['team'] == team and r['type'] == 'add']
        k = collections.Counter(add_kind(r['mlb_pos']) for r in adds); n = len(adds) or 1
        trades = [x for x in TR if x['season'] == y and team in (x['to_a'], x['to_b'])]
        partners = collections.Counter(m(y, x['to_b'] if x['to_a'] == team else x['to_a']) for x in trades)
        picks = sorted([r for r in D if r['season'] == str(y) and r['team'] == team], key=lambda r: int(r['overall']))
        kinds = [(int(r['round']), kind(y, r['player']), r['player']) for r in picks]
        first_sp = next((rd for rd, kd, _ in kinds if kd == 'SP'), None)
        first_rp = next((rd for rd, kd, _ in kinds if kd == 'RP'), None)
        early_h = sum(1 for rd, kd, _ in kinds if rd <= 5 and kd == 'H')
        rec = {'season': y, 'team': team, 'finish': int(re.sub(r'\D', '', fs[0]['rank'])), 'record': fs[0]['record'],
               'adds': len(adds), 'spAdds': round(100 * k['SP'] / n), 'rpAdds': round(100 * k['RP'] / n), 'hAdds': round(100 * k['H'] / n),
               'trades': len(trades), 'partners': partners.most_common(3),
               'firstSP': first_sp, 'firstRP': first_rp, 'hittersR1to5': early_h,
               'firstPicks': [p for _, _, p in kinds[:5]],
               'catRanks': {c: catrank.get((str(y), team, c)) for c in CATS}}
        managers.setdefault(who, []).append(rec)

# trade log with league-season ranks for each side
def rk(y, n):
    r = P.get((str(y), n)); return int(r['actual_rank']) if r else None
tradelog = [{'season': x['season'], 'date': x['date'], 'a': m(x['season'], x['to_a']), 'aGot': [[p[0], rk(x['season'], p[0])] for p in x['got_a']],
             'b': m(x['season'], x['to_b']), 'bGot': [[p[0], rk(x['season'], p[0])] for p in x['got_b']]} for x in TR]

# draft tendencies
groups = [(1, 3), (4, 6), (7, 10), (11, 15), (16, 22)]
tend = []
for a, b in groups:
    picks = [(r['season'], r['player']) for r in D if a <= int(r['round']) <= b]
    ks = collections.Counter(kind(*p) for p in picks); n = len(picks)
    row = {'rounds': f'{a}–{b}', 'n': n, 'share': {k: round(100 * ks[k] / n) for k in ['H', 'SP', 'RP']}}
    for k in ['H', 'SP', 'RP']:
        ranks = [int(P[p]['actual_rank']) for p in picks if kind(*p) == k and p in P]
        row[k] = {'n': len(ranks), 'median': int(st.median(ranks)) if len(ranks) >= 5 else None,
                  'top100': round(100 * sum(r <= 100 for r in ranks) / len(ranks)) if len(ranks) >= 5 else None}
    tend.append(row)
steals, busts = [], []
for r in D:
    rr = P.get((r['season'], r['player']))
    if not rr: continue
    ar = int(rr['actual_rank']); rd = int(r['round'])
    if rd >= 10 and ar <= 40: steals.append({'season': int(r['season']), 'round': rd, 'player': r['player'], 'rank': ar, 'by': m(r['season'], r['team'])})
    if rd <= 3 and ar > 250: busts.append({'season': int(r['season']), 'round': rd, 'player': r['player'], 'rank': ar, 'by': m(r['season'], r['team'])})
# position runs: average overall pick of the first 5 closers and first 12 SP each year
runs = []
for y in ['2023', '2024', '2025', '2026']:
    ps = sorted([r for r in D if r['season'] == y], key=lambda r: int(r['overall']))
    rp = [int(r['overall']) for r in ps if kind(y, r['player']) == 'RP']
    sp = [int(r['overall']) for r in ps if kind(y, r['player']) == 'SP']
    runs.append({'season': int(y), 'firstRP': rp[0] if rp else None, 'fifthRP': rp[4] if len(rp) > 4 else None,
                 'firstSP': sp[0] if sp else None, 'twelfthSP': sp[11] if len(sp) > 11 else None})

out = {'roster2027': ROSTER2027, 'team2026': TEAM2026, 'managers': managers, 'trades': tradelog,
       'tendencies': tend, 'steals': sorted(steals, key=lambda s: (-s['season'], s['round'])),
       'busts': sorted(busts, key=lambda s: (-s['season'], s['round'])), 'runs': runs,
       'mySlot': 12, 'myPicks': [r * 12 + (12 if r % 2 == 0 else 1) for r in range(22)]}
json.dump(out, open('../public/data/league.json', 'w'), separators=(',', ':'))
print('managers', {k: len(v) for k, v in managers.items()})
print(out['myPicks'][:6], runs)
