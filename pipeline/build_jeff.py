"""Eric vs. Jeff, every regular-season week, from each week's matchup totals -> ../public/data/jeff.json"""
import csv, json, collections, datetime

ERIC = {2023: 'Semien Retention', 2024: 'My Sweet Lourdes', 2025: 'Make Em Say Uhh Suzuki', 2026: 'Bury my Bats at Wounded Knee'}
JEFF = {y: 'Winfield Wants Noise' for y in ERIC}
CATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'W', 'SV', 'K', 'ERA', 'WHIP', 'KBB']
LOW = {'ERA', 'WHIP'}

def num(x):
    try: return float(x)
    except Exception: return None

def compare(a, b):
    w = l = t = 0
    for c in CATS:
        x, y = a.get(c), b.get(c)
        if x is None or y is None or x == y: t += 1
        elif (x > y) != (c in LOW): w += 1
        else: l += 1
    return w, l, t

def regular_weeks(path='data/weekly.csv'):
    reg = collections.defaultdict(set)
    for r in csv.DictReader(open(path)):
        if r['bracket'] == 'Regular season': reg[int(r['season'])].add(int(r['week']))
    return reg

def build(rows_path='data/weekly_stats.csv', eric=ERIC, jeff=JEFF, reg=None):
    reg = reg if reg is not None else regular_weeks()
    by = collections.defaultdict(dict)          # (season, week) -> team -> stats
    order = collections.defaultdict(list)       # (season, week) -> [team, team, ...] in matchup pairs
    for r in csv.DictReader(open(rows_path)):
        k = (int(r['season']), int(r['week']))
        by[k][r['team']] = {c: num(r[c]) for c in CATS}
        order[k].append(r['team'])
    seasons = []
    for y in sorted(eric):
        weeks = []
        for (s, w), teams in sorted(by.items()):
            if s != y or w not in reg.get(y, set()) or len(teams) < 12: continue
            e, j = teams.get(eric[y]), teams.get(jeff[y])
            if not e or not j: continue
            ww, ll, tt = compare(e, j)
            pairs = order[(s, w)]
            opp = {pairs[i]: pairs[i ^ 1] for i in range(len(pairs))}
            def allplay(me):
                tot = [0, 0, 0]
                for other, st in teams.items():
                    if other == me: continue
                    r = compare(teams[me], st); tot = [tot[0] + r[0], tot[1] + r[1], tot[2] + r[2]]
                return tot
            weeks.append({'week': w, 'eric': e, 'jeff': j, 'w': ww, 'l': ll, 't': tt, 'actual': opp.get(eric[y]) == jeff[y],
                          'ericAllPlay': allplay(eric[y]), 'jeffAllPlay': allplay(jeff[y])})
        seasons.append({'season': y, 'eric': eric[y], 'jeff': jeff[y], 'weeks': weeks})
    return seasons

if __name__ == '__main__':
    out = {'seasons': build(), 'updated': datetime.date.today().strftime('%b %-d, %Y')}
    json.dump(out, open('../public/data/jeff.json', 'w'), separators=(',', ':'))
    for s in out['seasons']:
        tot = [sum(w[k] for w in s['weeks']) for k in ('w', 'l', 't')]
        print(s['season'], len(s['weeks']), 'weeks', tot, 'actual', [w['week'] for w in s['weeks'] if w['actual']])
