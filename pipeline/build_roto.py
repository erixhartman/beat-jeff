"""What the standings would look like in rotisserie: each category ranked 1-12 on season totals, 12 points for first,
ties split. Built from the weekly matchup totals, so counting stats are exact and ratios are rebuilt from weekly lines
(ERA and WHIP from each week's rounded figures, OPS weighted by at-bats). -> ../public/data/roto.json"""
import csv, collections, datetime, json

CATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'W', 'SV', 'K', 'ERA', 'WHIP', 'KBB']
LOW = {'ERA', 'WHIP'}


def f(x):
    try: return float(str(x).rstrip('*'))
    except Exception: return None


def ip(x):
    a, _, b = str(x).rstrip('*').partition('.')
    try: return int(a) + int(b or 0) / 3
    except Exception: return 0.0


def totals(rows):
    T = collections.defaultdict(collections.Counter)
    for r in rows:
        t = T[r['team']]
        try: h, ab = map(int, str(r['HAB']).rstrip('*').split('/'))
        except Exception: continue
        i = ip(r['IP']); k = f(r['K']) or 0
        t['H'] += h; t['AB'] += ab; t['OPSw'] += (f(r['OPS']) or 0) * ab
        for c in ['R', 'HR', 'RBI', 'SB', 'W', 'SV', 'K']: t[c] += f(r[c]) or 0
        t['IP'] += i; t['ER'] += (f(r['ERA']) or 0) * i / 9; t['WH'] += (f(r['WHIP']) or 0) * i
        kbb = f(r['KBB']); t['BB'] += k / kbb if kbb else 0
    out = {}
    for team, t in T.items():
        if not t['AB'] or not t['IP']: continue
        out[team] = {'R': t['R'], 'HR': t['HR'], 'RBI': t['RBI'], 'SB': t['SB'], 'AVG': t['H'] / t['AB'], 'OPS': t['OPSw'] / t['AB'],
                     'W': t['W'], 'SV': t['SV'], 'K': t['K'], 'ERA': 9 * t['ER'] / t['IP'], 'WHIP': t['WH'] / t['IP'],
                     'KBB': t['K'] / t['BB'] if t['BB'] else t['K']}
    return out


def standings(tot):
    n = len(tot); pts = {t: {} for t in tot}
    for c in CATS:
        vals = sorted(tot.items(), key=lambda kv: kv[1][c], reverse=c not in LOW)
        i = 0
        while i < len(vals):
            j = i
            while j + 1 < len(vals) and round(vals[j + 1][1][c], 4) == round(vals[i][1][c], 4): j += 1
            p = sum(n - k for k in range(i, j + 1)) / (j - i + 1)
            for k in range(i, j + 1): pts[vals[k][0]][c] = p
            i = j + 1
    rows = [{'team': t, 'points': round(sum(pts[t].values()), 1),
             'cats': {c: {'value': round(tot[t][c], 3), 'pts': pts[t][c]} for c in CATS}} for t in tot]
    return sorted(rows, key=lambda r: -r['points'])


def build(path, season, weeks, out='../public/data/roto.json'):
    rows = [r for r in csv.DictReader(open(path)) if int(r['season']) == season and int(r['week']) in weeks]
    have = sorted({int(r['week']) for r in rows})
    if not have: return None
    now = standings(totals(rows))
    prev = standings(totals([r for r in rows if int(r['week']) < have[-1]])) if len(have) > 1 else []
    rank_prev = {r['team']: i for i, r in enumerate(prev, 1)}
    for i, r in enumerate(now, 1): r['move'] = (rank_prev[r['team']] - i) if r['team'] in rank_prev else 0
    data = {'season': season, 'throughWeek': have[-1], 'updated': datetime.date.today().strftime('%b %-d, %Y'), 'standings': now}
    json.dump(data, open(out, 'w'), separators=(',', ':'))
    return data


if __name__ == '__main__':
    reg = {int(r['week']) for r in csv.DictReader(open('data/weekly.csv')) if r['season'] == '2026' and r['bracket'] == 'Regular season'}
    d = build('data/weekly_stats.csv', 2026, reg)
    print(d['throughWeek'], [(r['team'], r['points'], r['move']) for r in d['standings'][:4]])
